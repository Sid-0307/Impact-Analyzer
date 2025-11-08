import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from './services/api.service';
import { Repository } from './models/types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatTooltipModule,
  ],
  template: `
    <mat-toolbar color="primary" class="main-toolbar">
      <div class="toolbar-content">
        <div class="brand" routerLink="/">
          <mat-icon class="brand-icon">analytics</mat-icon>
          <div class="brand-text">
            <span class="brand-title">Impact Analyzer</span>
            <span class="brand-subtitle"
              >Cross-Repo Dependency Intelligence</span
            >
          </div>
        </div>

        <div class="spacer"></div>

        <!-- Onboarded Repos Display -->
        <div class="repos-display" *ngIf="backendRepo || frontendRepo">
          <div
            class="repo-badge"
            *ngIf="backendRepo"
            matTooltip="Backend Repository"
          >
            <mat-icon>code</mat-icon>
            <span>{{ getShortRepoName(backendRepo.name) }}</span>
          </div>

          <mat-icon class="link-icon" *ngIf="backendRepo && frontendRepo"
            >link</mat-icon
          >

          <div
            class="repo-badge"
            *ngIf="frontendRepo"
            matTooltip="Frontend Repository"
          >
            <mat-icon>web</mat-icon>
            <span>{{ getShortRepoName(frontendRepo.name) }}</span>
          </div>
        </div>

        <button
          mat-raised-button
          class="onboard-button"
          routerLink="/onboard"
          [class.pulse]="!backendRepo && !frontendRepo"
        >
          <mat-icon>cloud_upload</mat-icon>
          {{ backendRepo || frontendRepo ? 'Re-onboard' : 'Onboard Repos' }}
        </button>
      </div>
    </mat-toolbar>

    <div class="content-wrapper">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [
    `
      .main-toolbar {
        position: sticky;
        top: 0;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        padding: 0 20px;
        min-height: 70px;
      }

      .toolbar-content {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 20px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .brand:hover {
        opacity: 0.9;
      }

      .brand-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
      }

      .brand-title {
        font-size: 20px;
        font-weight: 500;
        line-height: 1.2;
      }

      .brand-subtitle {
        font-size: 11px;
        opacity: 0.85;
        font-weight: 300;
      }

      .spacer {
        flex: 1;
      }

      .repos-display {
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(255, 255, 255, 0.15);
        padding: 8px 16px;
        border-radius: 20px;
        backdrop-filter: blur(10px);
      }

      .repo-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
      }

      .repo-badge mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .link-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        opacity: 0.7;
      }

      .onboard-button {
        background: white !important;
        color: #1976d2 !important;
        font-weight: 500;
      }

      .onboard-button mat-icon {
        margin-right: 6px;
      }

      .pulse {
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }

      .content-wrapper {
        min-height: calc(100vh - 70px);
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      }

      @media (max-width: 768px) {
        .repos-display {
          display: none;
        }

        .brand-subtitle {
          display: none;
        }
      }
    `,
  ],
})
export class AppComponent implements OnInit {
  backendRepo: Repository | null = null;
  frontendRepo: Repository | null = null;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadRepositories();
  }

  loadRepositories(): void {
    this.apiService.getRepositories().subscribe({
      next: (repos) => {
        this.backendRepo = repos.find((r) => r.type === 'backend') || null;
        this.frontendRepo = repos.find((r) => r.type === 'frontend') || null;
      },
      error: (err) => {
        console.error('Error loading repos:', err);
      },
    });
  }

  getShortRepoName(fullName: string): string {
    const parts = fullName.split('/');
    return parts[parts.length - 1];
  }
}
