# ----------------------------- Helper Functions -----------------------------

$modulePath = Join-Path $env:SOURCE_PATH "utils/common.psm1"
if (-not (Test-Path $modulePath)) {
    Write-Error "Error: Common module not found at $modulePath"
    exit 1
}
Import-Module $modulePath -Force

# ------------------------------- Pre Actions -------------------------------

Write-Separator -title "Checking Parameters"
$Mode = if ($args[0]) { $args[0] } else { "all" }
$Message = if ($args[1]) { $args[1] } else { "updating repository" }

Test-Parameter -key "Mode" -value $Mode
Test-Parameter -key "Message" -value $Message

# ------------------------------- Main Script -------------------------------

Write-Separator -title "Starting Git Push"

try {
    if ($Mode -eq "all") {
        Write-Host "Adding all files..."
        git add .
    } elseif ($Mode -eq "tracked") {
        Write-Host "Adding only tracked files..."
        git add -u
    } else {
        Write-Error "Invalid mode: $Mode"
        exit 1
    }

    Write-Host "Committing with message: $Message"
    $commitResult = git commit -m $Message
    if ($LASTEXITCODE -ne 0) {
        if ($commitResult -match "nothing to commit") {
            Write-Host "No changes to commit"
            exit 0
        }
        Write-Error "Commit failed"
        exit 1
    }

    Write-Host "Pushing to remote..."
    git push
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Push failed"
        exit 1
    }
} catch {
    Write-Error "Error during git operations: $_"
    exit 1
}

# ------------------------------- Post Actions -------------------------------

Write-Separator -title "Git Push completed successfully"
