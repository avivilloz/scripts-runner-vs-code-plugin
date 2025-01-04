# ----------------------------- Helper Functions -----------------------------

$modulePath = Join-Path $env:SOURCE_PATH "utils/common.psm1"
if (-not (Test-Path $modulePath)) {
    Write-Error "Error: Common module not found at $modulePath"
    exit 1
}
Import-Module $modulePath -Force

# ------------------------------- Pre Actions -------------------------------

Write-Separator -title "Checking Parameters"
$GitName = if ($args[0]) { $args[0] } else { $null }
$GitEmail = if ($args[1]) { $args[1] } else { $null }
$GitScope = if ($args[2]) { $args[2] } else { "local" }

Test-Parameter -key "name" -value $GitName
Test-Parameter -key "email" -value $GitEmail
Test-Parameter -key "scope" -value $GitScope

# ------------------------------- Main Script -------------------------------

Write-Separator -title "Configuring Git"

$ScopeFlag = if ($GitScope -eq "global") { "--global" } else { "--local" }

Write-Host "Setting git config with scope: $GitScope"
git config $ScopeFlag user.name $GitName
git config $ScopeFlag user.email $GitEmail

Write-Host "`nVerifying settings:"
Write-Host "User name: $(git config $ScopeFlag user.name)"
Write-Host "User email: $(git config $ScopeFlag user.email)"

# ------------------------------- Post Actions -------------------------------

Write-Separator -title "Git configuration completed successfully"