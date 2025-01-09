# ----------------------------- Helper Functions -----------------------------

$modulePath = Join-Path $env:SOURCE_PATH "utils/common.psm1"
if (-not (Test-Path $modulePath)) {
    Write-Error "Error: Common module not found at $modulePath"
    exit 1
}
Import-Module $modulePath -Force

# ------------------------------- Pre Actions -------------------------------

Write-Separator -title "Checking Parameters"
$Alias = if ($args[0]) { $args[0] } else { $null }

Test-Parameter -key "Alias" -value $Alias

$SshDir = Join-Path $env:USERPROFILE ".ssh"
$SshDirTilde = "~/.ssh"
$IdentityFile = Join-Path $SshDir $Alias
$AuthorizedKeysFile = Join-Path $SshDirTilde "authorized_keys"

# ------------------------------- Main Script -------------------------------

Write-Separator -title "Creating .ssh directory if it doesn't exist"

New-Item -Path $SshDir -ItemType Directory -Force | Out-Null
# Set restrictive permissions (commented out)
# $acl = Get-Acl $SshDir
# $acl.SetAccessRuleProtection($true, $false)
# $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME, "FullControl", "Allow")
# $acl.AddAccessRule($rule)
# Set-Acl $SshDir $acl

Write-Host "SSH directory created"

Write-Separator -title "Generating SSH Key"

try {
    ssh-keygen -t ed25519 -f $IdentityFile -N '""'
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to generate SSH key"
        exit 1
    }

    # Set proper permissions on the private key (commented out)
    # $acl = Get-Acl $IdentityFile
    # $acl.SetAccessRuleProtection($true, $false)
    # $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME, "Read", "Allow")
    # $acl.AddAccessRule($rule)
    # Set-Acl $IdentityFile $acl
} catch {
    Write-Error "Error during SSH setup: $_"
    exit 1
}

# ------------------------------- Post Actions -------------------------------

Write-Separator -title "SSH key generated successfully"

Write-Host "Copy and paste this public SSH key to your remote host $AuthorizedKeysFile:"
Write-Host ""
Get-Content "${IdentityFile}.pub"
Write-Host ""
