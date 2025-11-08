import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../services/api.service';
import { PullRequest, AffectedNode } from '../../models/types';

@Component({
  selector: 'app-pr-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatListModule,
    MatDividerModule,
  ],
  template: `
    <div class="container" *ngIf="pullRequest">
      <!-- Header -->
      <mat-card class="header-card">
        <mat-card-content>
          <button mat-icon-button routerLink="/" class="back-button">
            <mat-icon>arrow_back</mat-icon>
          </button>

          <div class="pr-header">
            <div class="pr-title">
              <h1>#{{ pullRequest.pr_number }} {{ pullRequest.title }}</h1>
              <mat-chip
                [class]="'risk-' + pullRequest.impact.risk_level.toLowerCase()"
              >
                {{ pullRequest.impact.risk_level }} RISK
              </mat-chip>
            </div>

            <div class="pr-meta">
              <span>
                <mat-icon>person</mat-icon>
                {{ pullRequest.author }}
              </span>
              <span>
                <mat-icon>schedule</mat-icon>
                {{ pullRequest.created_at | date : 'medium' }}
              </span>
              <span>
                <mat-icon>code</mat-icon>
                {{ getRepoName(pullRequest.repo_url) }}
              </span>
            </div>

            <a
              *ngIf="pullRequest.comment_url"
              [href]="pullRequest.comment_url"
              target="_blank"
              mat-raised-button
              color="primary"
            >
              <mat-icon>open_in_new</mat-icon>
              View GitHub Comment
            </a>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Impact Summary -->
      <mat-card class="summary-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>analytics</mat-icon>
            Impact Summary
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-number">
                {{ pullRequest.impact.changed_files.length }}
              </div>
              <div class="summary-label">Changed Files</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">
                {{ pullRequest.impact.affected_backend.length }}
              </div>
              <div class="summary-label">Backend Affected</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">
                {{ pullRequest.impact.affected_frontend.length }}
              </div>
              <div class="summary-label">Frontend Affected</div>
            </div>
            <div class="summary-item">
              <div class="summary-number">
                {{ pullRequest.impact.affected_tests.length }}
              </div>
              <div class="summary-label">Tests to Update</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Detailed Impact -->
      <mat-card>
        <mat-tab-group>
          <!-- Changed Files Tab -->
          <mat-tab
            label="Changed Files ({{
              pullRequest.impact.changed_files.length
            }})"
          >
            <div class="tab-content">
              <mat-list *ngIf="pullRequest.impact.changed_files.length > 0">
                <mat-list-item
                  *ngFor="let change of pullRequest.impact.changed_files"
                >
                  <mat-icon matListItemIcon>edit</mat-icon>
                  <div matListItemTitle>
                    <code>{{ change.file }}</code>
                  </div>
                  <div matListItemLine>
                    Node: <strong>{{ change.node }}</strong>
                  </div>
                </mat-list-item>
              </mat-list>
              <div
                *ngIf="pullRequest.impact.changed_files.length === 0"
                class="empty-state"
              >
                <p>No changed files detected</p>
              </div>
            </div>
          </mat-tab>

          <!-- Backend Impact Tab -->
          <mat-tab
            label="Backend Impact ({{
              pullRequest.impact.affected_backend.length
            }})"
          >
            <div class="tab-content">
              <mat-list *ngIf="pullRequest.impact.affected_backend.length > 0">
                <mat-list-item
                  *ngFor="let node of pullRequest.impact.affected_backend"
                >
                  <mat-icon
                    matListItemIcon
                    [style.color]="getNodeIconColor(node.type)"
                  >
                    {{ getNodeIcon(node.type) }}
                  </mat-icon>
                  <div matListItemTitle>
                    <strong>{{ node.id }}</strong>
                    <mat-chip class="type-chip">{{ node.type }}</mat-chip>
                  </div>
                  <div matListItemLine>
                    <code>{{ node.file }}</code>
                  </div>
                  <div matListItemLine *ngIf="node.endpoint">
                    Endpoint:
                    <code
                      >{{ node.endpoint.method }} {{ node.endpoint.path }}</code
                    >
                  </div>
                </mat-list-item>
              </mat-list>
              <div
                *ngIf="pullRequest.impact.affected_backend.length === 0"
                class="empty-state"
              >
                <p>No backend files affected</p>
              </div>
            </div>
          </mat-tab>

          <!-- Frontend Impact Tab -->
          <mat-tab
            label="Frontend Impact ({{
              pullRequest.impact.affected_frontend.length
            }})"
          >
            <div class="tab-content">
              <mat-list *ngIf="pullRequest.impact.affected_frontend.length > 0">
                <mat-list-item
                  *ngFor="let node of pullRequest.impact.affected_frontend"
                >
                  <mat-icon
                    matListItemIcon
                    [style.color]="getNodeIconColor(node.type)"
                  >
                    {{ getNodeIcon(node.type) }}
                  </mat-icon>
                  <div matListItemTitle>
                    <strong>{{ node.id }}</strong>
                    <mat-chip class="type-chip">{{ node.type }}</mat-chip>
                  </div>
                  <div matListItemLine>
                    <code>{{ node.file }}</code>
                  </div>
                </mat-list-item>
              </mat-list>
              <div
                *ngIf="pullRequest.impact.affected_frontend.length === 0"
                class="empty-state"
              >
                <p>No frontend files affected</p>
              </div>
            </div>
          </mat-tab>

          <!-- Tests Tab -->
          <mat-tab
            label="Tests to Update ({{
              pullRequest.impact.affected_tests.length
            }})"
          >
            <div class="tab-content">
              <mat-list *ngIf="pullRequest.impact.affected_tests.length > 0">
                <mat-list-item
                  *ngFor="let test of pullRequest.impact.affected_tests"
                >
                  <mat-icon matListItemIcon color="warn">bug_report</mat-icon>
                  <div matListItemTitle>
                    <strong>{{ test.id }}</strong>
                  </div>
                  <div matListItemLine>
                    <code>{{ test.file }}</code>
                  </div>
                </mat-list-item>
              </mat-list>
              <div
                *ngIf="pullRequest.impact.affected_tests.length === 0"
                class="empty-state"
              >
                <p>No tests need updating</p>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>

      <!-- Dependency Graph Link -->
      <mat-card class="graph-link-card">
        <mat-card-content>
          <button
            mat-raised-button
            color="accent"
            [routerLink]="['/graph']"
            [queryParams]="{ repo: getRepoName(pullRequest.repo_url) }"
          >
            <mat-icon>hub</mat-icon>
            View Dependency Graph
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }

      mat-card {
        margin-bottom: 20px;
      }

      .header-card {
        position: relative;
      }

      .back-button {
        position: absolute;
        top: 10px;
        left: 10px;
      }

      .pr-header {
        padding-left: 50px;
      }

      .pr-title {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 15px;
      }

      .pr-title h1 {
        margin: 0;
        font-size: 24px;
      }

      .pr-meta {
        display: flex;
        gap: 20px;
        margin-bottom: 15px;
        color: #666;
      }

      .pr-meta span {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .pr-meta mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .summary-card mat-card-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 20px;
        margin-top: 20px;
      }

      .summary-item {
        text-align: center;
        padding: 20px;
        background: #f5f5f5;
        border-radius: 8px;
      }

      .summary-number {
        font-size: 36px;
        font-weight: bold;
        color: #1976d2;
      }

      .summary-label {
        margin-top: 8px;
        color: #666;
        font-size: 14px;
      }

      .tab-content {
        padding: 20px;
        min-height: 200px;
      }

      .empty-state {
        text-align: center;
        padding: 40px;
        color: #999;
      }

      .type-chip {
        margin-left: 10px;
        height: 20px;
        font-size: 11px;
      }

      .risk-low {
        background-color: #4caf50 !important;
        color: white !important;
      }

      .risk-medium {
        background-color: #ff9800 !important;
        color: white !important;
      }

      .risk-high {
        background-color: #f44336 !important;
        color: white !important;
      }

      .risk-critical {
        background-color: #9c27b0 !important;
        color: white !important;
      }

      .graph-link-card {
        text-align: center;
      }

      code {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
      }
    `,
  ],
})
export class PrDetailComponent implements OnInit {
  pullRequest: PullRequest | null = null;

  constructor(private route: ActivatedRoute, private apiService: ApiService) {}

  ngOnInit(): void {
    const prId = this.route.snapshot.paramMap.get('id');
    if (prId) {
      this.loadPullRequest(parseInt(prId));
    }
  }

  loadPullRequest(id: number): void {
    this.apiService.getPullRequests().subscribe({
      next: (prs: any) => {
        this.pullRequest = prs.find((pr: any) => pr.id === id) || null;
      },
      error: (err: any) => {
        console.error('Error loading PR:', err);
      },
    });
  }

  getRepoName(url: string): string {
    const parts = url.split('/');
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`.replace(
      '.git',
      ''
    );
  }

  getNodeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      controller: 'router',
      service: 'settings',
      angular_service: 'build',
      angular_component: 'web',
      test: 'bug_report',
    };
    return iconMap[type] || 'code';
  }

  getNodeIconColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      controller: '#1976d2',
      service: '#4caf50',
      angular_service: '#ff9800',
      angular_component: '#9c27b0',
      test: '#f44336',
    };
    return colorMap[type] || '#666';
  }
}
