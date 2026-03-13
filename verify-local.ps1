param(
    [switch]$SkipPlaywright
)

$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $rootDir 'frontend'
$backendDir = Join-Path $rootDir 'backend'

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Action
    )

    Write-Host ''
    Write-Host "=== $Label ===" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed."
    }
}

Invoke-Step -Label 'Frontend lint' -Action {
    Set-Location $frontendDir
    npm.cmd run lint
}

Invoke-Step -Label 'Frontend build' -Action {
    Set-Location $frontendDir
    npm.cmd run build
}

Invoke-Step -Label 'Frontend vitest' -Action {
    Set-Location $frontendDir
    npm.cmd run test:run
}

Invoke-Step -Label 'Backend tests' -Action {
    Set-Location $backendDir
    .\mvnw.cmd test
}

if (-not $SkipPlaywright) {
    Invoke-Step -Label 'Playwright full suite' -Action {
        Set-Location $rootDir
        npx.cmd playwright test --config playwright.config.js --workers=1
    }
}

Write-Host ''
Write-Host 'Local verification completed successfully.' -ForegroundColor Green
