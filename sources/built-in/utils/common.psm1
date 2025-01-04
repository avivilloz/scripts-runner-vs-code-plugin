function Test-Parameter {
    param (
        [string]$key,
        [string]$value
    )
    
    Write-Host "Testing parameter: $key=$value"
    
    if ([string]::IsNullOrEmpty($value)) {
        Write-Error "Error: Value for $key is required."
        exit 1
    }
}

function Write-Separator {
    param (
        [string]$title
    )
    
    Write-Host ""
    Write-Host "------------------------------------------------------------------"
    if (-not [string]::IsNullOrEmpty($title)) {
        Write-Host "- $title"
        Write-Host "------------------------------------------------------------------"
    }
    Write-Host ""
}

Export-ModuleMember -Function Test-Parameter, Write-Separator
