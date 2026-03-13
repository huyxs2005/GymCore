param(
    [string]$SqlServer = 'tcp:localhost,1433',
    [string]$SqlUser = 'sa',
    [string]$SqlPassword = '5',
    [switch]$DropExisting = $true,
    [switch]$SkipTestingData
)

$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$docsDir = Join-Path $rootDir 'docs'

function Assert-SqlCmdInstalled {
    $sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if (-not $sqlcmd) {
        throw 'sqlcmd was not found in PATH. Install SQL Server command-line tools before seeding the database.'
    }
}

function Invoke-SqlFile {
    param(
        [string]$Database,
        [string]$FilePath
    )

    if (-not (Test-Path $FilePath)) {
        throw "SQL file was not found: $FilePath"
    }

    Write-Host "Running $(Split-Path $FilePath -Leaf) on [$Database]..." -ForegroundColor Cyan
    & sqlcmd -S $SqlServer -U $SqlUser -P $SqlPassword -d $Database -b -i $FilePath
    if ($LASTEXITCODE -ne 0) {
        throw "sqlcmd failed while running $(Split-Path $FilePath -Leaf)."
    }
}

Assert-SqlCmdInstalled

if ($DropExisting) {
    Write-Host 'Dropping existing GymCore database if it exists...' -ForegroundColor Yellow
    & sqlcmd -S $SqlServer -U $SqlUser -P $SqlPassword -d master -b -Q "IF DB_ID(N'GymCore') IS NOT NULL BEGIN ALTER DATABASE [GymCore] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [GymCore]; END"
    if ($LASTEXITCODE -ne 0) {
        throw 'sqlcmd failed while dropping the existing GymCore database.'
    }
}

Invoke-SqlFile -Database 'master' -FilePath (Join-Path $docsDir 'GymCore.txt')
Invoke-SqlFile -Database 'GymCore' -FilePath (Join-Path $docsDir 'alter.txt')
Invoke-SqlFile -Database 'GymCore' -FilePath (Join-Path $docsDir 'InsertValues.txt')

if (-not $SkipTestingData) {
    Invoke-SqlFile -Database 'GymCore' -FilePath (Join-Path $docsDir 'InsertTestingValues.txt')
}

Write-Host 'GymCore database seed completed successfully.' -ForegroundColor Green
