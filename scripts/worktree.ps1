<#
.SYNOPSIS
    Gestor de Git Worktrees para el desarrollo paralelo de agentes en SportComplex.
.DESCRIPTION
    Permite crear, listar y eliminar worktrees de forma segura para aislar ramas de trabajo.
.EXAMPLE
    .\scripts\worktree.ps1 -Action add -Branch "feature/SC-102-auth"
    .\scripts\worktree.ps1 -Action list
    .\scripts\worktree.ps1 -Action remove -Branch "feature/SC-102-auth"
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [ValidateSet('add', 'list', 'remove')]
    [string]$Action,

    [Parameter(Mandatory = $false)]
    [string]$Branch = '',

    [Parameter(Mandatory = $false)]
    [string]$BaseBranch = 'develop'
)

$ErrorActionPreference = 'Stop'

# Raíz del proyecto
$RepoRoot = (git rev-parse --show-toplevel).Trim()
$WorktreesParent = Join-Path (Split-Path $RepoRoot -Parent) ".worktrees"

function Sanitize-BranchName ([string]$name) {
    return ($name -replace '[\\/:]', '-')
}

switch ($Action) {
    'list' {
        Write-Host "=== Git Worktrees Activos ===" -ForegroundColor Cyan
        git worktree list
    }

    'add' {
        if (-not $Branch) {
            Write-Error "El parámetro -Branch es obligatorio para la acción 'add'."
        }

        $FolderName = Sanitize-BranchName $Branch
        $TargetDir = Join-Path $WorktreesParent $FolderName

        if (-not (Test-Path $WorktreesParent)) {
            New-Item -ItemType Directory -Path $WorktreesParent | Out-Null
        }

        if (Test-Path $TargetDir) {
            Write-Warning "El directorio del worktree ya existe: $TargetDir"
            return
        }

        Write-Host "Creando worktree en: $TargetDir" -ForegroundColor Green
        
        # Verificar si la rama ya existe en git
        $branchExists = git branch --list $Branch
        if ($branchExists) {
            git worktree add $TargetDir $Branch
        } else {
            git worktree add $TargetDir -b $Branch $BaseBranch
        }

        Write-Host "Worktree creado exitosamente para '$Branch'." -ForegroundColor Green
        Write-Host "Ruta: $TargetDir" -ForegroundColor Yellow
        Write-Host "Recuerda ejecutar 'pnpm install' en la nueva ruta si agregas nuevas dependencias." -ForegroundColor DarkGray
    }

    'remove' {
        if (-not $Branch) {
            Write-Error "El parámetro -Branch es obligatorio para la acción 'remove'."
        }

        $FolderName = Sanitize-BranchName $Branch
        $TargetDir = Join-Path $WorktreesParent $FolderName

        Write-Host "Eliminando worktree: $TargetDir" -ForegroundColor Yellow
        git worktree remove $TargetDir --force
        git worktree prune

        Write-Host "Worktree '$FolderName' eliminado y referencias limpiadas." -ForegroundColor Green
    }
}
