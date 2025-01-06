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
$NewBranch = if ($args[2]) { $args[2] } else { "none" }

Test-Parameter -key "Mode" -value $Mode
Test-Parameter -key "Message" -value $Message

# ------------------------------- Main Script -------------------------------

Write-Separator -title "Starting Git Push"

try {
    if ($NewBranch -ne "none") {
        Write-Host "Creating new branch: $NewBranch"
        git checkout -b $NewBranch
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to create new branch"
            exit 1
        }
    }

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
        Write-Host "No changes to commit or commit failed"
    }

    Write-Host "Pushing to remote..."
    # Get current branch name
    $currentBranch = git symbolic-ref --short HEAD
    # Check if branch has upstream
    $hasUpstream = git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>$null
    if ($LASTEXITCODE -eq 0) {
        git push
    } else {
        Write-Host "No upstream branch set. Setting upstream to origin/$currentBranch..."
        git push --set-upstream origin $currentBranch
    }
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
