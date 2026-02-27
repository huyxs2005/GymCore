param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $rootDir 'backend'
$frontendDir = Join-Path $rootDir 'frontend'

if (-not (Test-Path (Join-Path $backendDir 'mvnw.cmd'))) {
    throw "Backend wrapper not found at: $backendDir\mvnw.cmd"
}

if (-not (Test-Path (Join-Path $frontendDir 'package.json'))) {
    throw "Frontend package.json not found at: $frontendDir\package.json"
}

$backendRunCommand = '.\mvnw.cmd spring-boot:run'
try {
    $jdkRootReg = 'HKLM:\SOFTWARE\JavaSoft\JDK'
    if (Test-Path $jdkRootReg) {
        $currentVersion = (Get-ItemProperty $jdkRootReg).CurrentVersion
        if ($currentVersion) {
            $javaHome = (Get-ItemProperty (Join-Path $jdkRootReg $currentVersion)).JavaHome
            if ($javaHome -match '^[A-Za-z]:$' -and (Test-Path "$javaHome\bin\java.exe")) {
                $backendRunCommand = ".\mvnw.cmd --% -Djava.home=$javaHome/ spring-boot:run"
            }
        }
    }
}
catch {
}

$backendArgs = @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', $backendRunCommand
)

$frontendArgs = @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', 'npm run dev'
)

if ($DryRun) {
    Write-Host '[DryRun] Backend window command:'
    Write-Host "powershell $($backendArgs -join ' ')" -ForegroundColor Yellow
    Write-Host "[DryRun] WorkingDirectory: $backendDir"
    Write-Host ''
    Write-Host '[DryRun] Frontend window command:'
    Write-Host "powershell $($frontendArgs -join ' ')" -ForegroundColor Yellow
    Write-Host "[DryRun] WorkingDirectory: $frontendDir"
    exit 0
}

Start-Process -FilePath 'powershell' -WorkingDirectory $backendDir -ArgumentList $backendArgs | Out-Null
Start-Process -FilePath 'powershell' -WorkingDirectory $frontendDir -ArgumentList $frontendArgs | Out-Null

Write-Host 'Started backend and frontend in two new PowerShell windows.' -ForegroundColor Green
Write-Host 'Backend:  http://localhost:8080'
Write-Host 'Frontend: http://localhost:5173'
