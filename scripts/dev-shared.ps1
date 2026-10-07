<#
.SYNOPSIS
  Lance Huntited en mode « registre partagé » (backend + front) pour tester à
  plusieurs, sur ce PC ou sur le même Wi-Fi. Aucun vrai KAS n'est utilisé.

.EXAMPLE
  ./scripts/dev-shared.ps1                 # wallet Kastle (signatures réelles, testnet-10)
  ./scripts/dev-shared.ps1 -Wallet mock    # wallet factice (téléphones sans extension)
  ./scripts/dev-shared.ps1 -MinThreshold 2 # seuil minimum abaissé (tester à 2 navigateurs)
  ./scripts/dev-shared.ps1 -Pass           # pass exigés pour s'engager (anti-bots) :
                                           # affiche 3 invitations de départ
  ./scripts/dev-shared.ps1 -Chain -MinThreshold 2
                                           # registre sur la blockchain (réseau de test)

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
  [int]$MinThreshold = 7,
  # Pass Huntited exigés pour s'engager (une personne = un engagement).
  [switch]$Pass,
  # Registre sur la blockchain (réseau de test) : créer et s'engager envoient
  # 0,2 KAS de test au registre par Kastle (docs/registre-kaspa.md).
  [switch]$Chain
)
if ($Chain -and $Wallet -ne "kastle") { throw "-Chain exige le wallet Kastle." }
$dataMode = if ($Chain) { "chain" } else { "api" }

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# Adresse du PC sur le Wi-Fi / réseau local (pour les autres appareils).
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.PrefixOrigin -eq "Dhcp" -and $_.IPAddress -notlike "169.254.*" } |
  Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "localhost" }

$authMode = if ($Wallet -eq "mock") { "mock" } else { "signature" }

# Invitations de départ (aléatoires, valables pour cette session) : le
# premier pass ne peut venir que d'elles. Les pass restent dans data/passes.json.
$genesis = @()
if ($Pass) {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $genesis = 1..3 | ForEach-Object {
    $bytes = New-Object byte[] 24
    $rng.GetBytes($bytes)
    [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
  }
}
$passRequired = if ($Pass) { "true" } else { "false" }

# Clés des notifications « me prévenir » : générées une fois, gardées dans
# backend/data/vapid.json (hors git) pour que les abonnements restent valables.
$vapidFile = "$root\backend\data\vapid.json"
if (-not (Test-Path $vapidFile)) {
  New-Item -ItemType Directory -Force "$root\backend\data" | Out-Null
  Push-Location "$root\backend"
  node -e "process.stdout.write(JSON.stringify(require('web-push').generateVAPIDKeys()))" |
    Out-File -Encoding ascii $vapidFile
  Pop-Location
}
$vapid = Get-Content $vapidFile -Raw | ConvertFrom-Json
$genesisList = $genesis -join ","

$backend = @"
`$env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
`$env:PORT='$ApiPort'
`$env:CORS_ORIGIN='http://localhost:$FrontPort,http://${ip}:$FrontPort'
`$env:WALLET_AUTH_MODE='$authMode'
`$env:REGISTRY_FILE='data/registry.json'
`$env:MIN_HUNT_THRESHOLD='$MinThreshold'
`$env:PASS_REQUIRED='$passRequired'
`$env:PASS_FILE='data/passes.json'
`$env:PASS_GENESIS_INVITES='$genesisList'
`$env:PUSH_VAPID_PUBLIC_KEY='$($vapid.publicKey)'
`$env:PUSH_VAPID_PRIVATE_KEY='$($vapid.privateKey)'
`$env:PUSH_FILE='data/push.json'
`$env:CHAT_FILE='data/chats.json'
`$env:CHAIN_INDEX='true'
Set-Location '$root\backend'
bun run dev
"@

$front = @"
`$env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
`$env:VITE_DATA_MODE='$dataMode'
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
if ($Pass) {
  Write-Host "Pass exigés pour s'engager. Invitations de départ (une personne chacune) :" -ForegroundColor Yellow
  foreach ($g in $genesis) { Write-Host "  http://localhost:$FrontPort/pass#$g" }
  Write-Host "Ensuite, chaque membre invite les autres depuis « Mon pass »."
  Write-Host ""
}
Write-Host "Deux fenêtres se sont ouvertes (backend, front). Ferme-les pour tout arrêter."
Write-Host "Au premier lancement, Windows peut demander d'autoriser Node sur le réseau privé :"
Write-Host "accepte pour que les autres appareils puissent se connecter."
