<#
.SYNOPSIS
  Lance Huntited en mode « registre partagé » (backend + front) pour tester à
  plusieurs, sur ce PC ou sur le même Wi-Fi. Aucun vrai KAS n'est utilisé.

.EXAMPLE
  ./scripts/dev-shared.ps1                 # wallet Kastle (signatures réelles, testnet-10)
  ./scripts/dev-shared.ps1 -Wallet mock    # wallet factice (téléphones sans extension)
  ./scripts/dev-shared.ps1 -MinThreshold 2 # seuil minimum abaissé (tester à 2 navigateurs)

.NOTES
  Les réglages sont passés aux deux serveurs le temps de la session : tes
  fichiers .env ne sont pas modifiés (les variables passées ici l'emportent).
  Les chasses sont conservées dans backend/data/registry.json (hors git).
#>
param(
  [ValidateSet("kastle", "mock")]
  [string]$Wallet = "kastle",
  [int]$FrontPort = 5173,
  [int]$ApiPort = 3001,
  # Seuil minimum d'une chasse (7 = règle réelle ; plus bas pour tester à peu).
  [ValidateRange(1, 7)]
  [int]$MinThreshold = 7
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# Adresse du PC sur le Wi-Fi / réseau local (pour les autres appareils).
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.PrefixOrigin -eq "Dhcp" -and $_.IPAddress -notlike "169.254.*" } |
  Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "localhost" }

$authMode = if ($Wallet -eq "mock") { "mock" } else { "signature" }

$backend = @"
`$env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
`$env:PORT='$ApiPort'
`$env:CORS_ORIGIN='http://localhost:$FrontPort,http://${ip}:$FrontPort'
`$env:WALLET_AUTH_MODE='$authMode'
`$env:REGISTRY_FILE='data/registry.json'
`$env:MIN_HUNT_THRESHOLD='$MinThreshold'
Set-Location '$root\backend'
bun run dev
"@

$front = @"
`$env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
`$env:VITE_DATA_MODE='api'
`$env:VITE_MATRIX_MODE='api'
`$env:VITE_WALLET_MODE='$Wallet'
`$env:VITE_API_BASE_URL='http://${ip}:$ApiPort'
`$env:VITE_MIN_THRESHOLD='$MinThreshold'
Set-Location '$root'
bun x vite dev --host --port $FrontPort --strictPort
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backend -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", $front -WindowStyle Normal

Write-Host ""
Write-Host "Huntited — registre partagé (wallet : $Wallet, seuil minimum : $MinThreshold)" -ForegroundColor Green
Write-Host "  Sur ce PC          : http://localhost:$FrontPort"
Write-Host "  Autres appareils   : http://${ip}:$FrontPort  (même Wi-Fi)"
Write-Host "  Backend            : http://${ip}:$ApiPort/health"
Write-Host ""
Write-Host "Deux fenêtres se sont ouvertes (backend, front). Ferme-les pour tout arrêter."
Write-Host "Au premier lancement, Windows peut demander d'autoriser Node sur le réseau privé :"
Write-Host "accepte pour que les autres appareils puissent se connecter."
