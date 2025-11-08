import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../services/api.service';
import { PullRequest } from '../../models/types';

@Component({
  selector: 'app-pr-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatChipsModule,
    MatCardModule,
    MatIconModule,
  ],
  template: `
    <div class="container">
      <div class="hero-section">
        <h1>Pull Request Impact Dashboard</h1>
        <p>Real-time cross-repository dependency analysis</p>
      </div>

      <mat-card class="table-card">
        <table mat-table [dataSource]="pullRequests" class="pr-table">
          <!-- PR Number -->
          <ng-container matColumnDef="pr_number">
            <th mat-header-cell *matHeaderCellDef>PR #</th>
            <td mat-cell *matCellDef="let pr">
              <strong>#{{ pr.pr_number }}</strong>
            </td>
          </ng-container>

          <!-- Title -->
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef>Title</th>
            <td mat-cell *matCellDef="let pr">{{ pr.title }}</td>
          </ng-container>

          <!-- Repository -->
          <ng-container matColumnDef="repo">
            <th mat-header-cell *matHeaderCellDef>Repository</th>
            <td mat-cell *matCellDef="let pr">
              <code>{{ getRepoName(pr.repo_url) }}</code>
            </td>
          </ng-container>

          <!-- Author -->
          <ng-container matColumnDef="author">
            <th mat-header-cell *matHeaderCellDef>Author</th>
            <td mat-cell *matCellDef="let pr">
              <mat-icon class="author-icon">person</mat-icon>
              {{ pr.author }}
            </td>
          </ng-container>

          <!-- Risk Level -->
          <ng-container matColumnDef="risk_level">
            <th mat-header-cell *matHeaderCellDef>Risk</th>
            <td mat-cell *matCellDef="let pr">
              <mat-chip [class]="'risk-' + pr.impact.risk_level.toLowerCase()">
                {{ pr.impact.risk_level }}
              </mat-chip>
            </td>
          </ng-container>

          <!-- Impact Summary -->
          <ng-container matColumnDef="impact_summary">
            <th mat-header-cell *matHeaderCellDef>Impact</th>
            <td mat-cell *matCellDef="let pr">
              <span class="impact-badge">
                {{ getTotalAffected(pr) }} files
              </span>
            </td>
          </ng-container>

          <!-- Date -->
          <ng-container matColumnDef="created_at">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let pr">
              {{ pr.created_at | date : 'short' }}
            </td>
          </ng-container>

          <!-- Actions -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let pr">
              <button
                mat-icon-button
                color="primary"
                [routerLink]="['/pr', pr.id]"
                matTooltip="View Details"
              >
                <mat-icon>visibility</mat-icon>
              </button>
              <a
                *ngIf="pr.comment_url"
                [href]="pr.comment_url"
                target="_blank"
                mat-icon-button
                matTooltip="View GitHub Comment"
              >
                <mat-icon>open_in_new</mat-icon>
              </a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>

        <div *ngIf="pullRequests.length === 0" class="empty-state">
          <mat-icon>inbox</mat-icon>
          <h3>No Pull Requests Analyzed Yet</h3>
          <p>
            Onboard repositories and create PRs to see impact analysis here.
          </p>
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 20px;
        max-width: 1400px;
        margin: 0 auto;
      }

      mat-card {
        margin-bottom: 20px;
      }

      mat-card-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 24px;
      }

      .actions {
        margin-bottom: 20px;
      }

      .pr-table {
        width: 100%;
        background: white;
      }

      .pr-table th {
        font-weight: 600;
      }

      .author-icon {
        vertical-align: middle;
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 5px;
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

      .impact-badge {
        background: #e3f2fd;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        color: #1976d2;
      }

      .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #999;
      }

      .empty-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #ccc;
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
export class PrListComponent implements OnInit {
  pullRequests: PullRequest[] = [];
  displayedColumns: string[] = [
    'pr_number',
    'title',
    'repo',
    'author',
    'risk_level',
    'impact_summary',
    'created_at',
    'actions',
  ];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadPullRequests();
  }

  loadPullRequests(): void {
    this.apiService.getPullRequests().subscribe({
      next: (prs) => {
        this.pullRequests = prs;
      },
      error: (err) => {
        console.error('Error loading PRs:', err);
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

  getTotalAffected(pr: PullRequest): number {
    const impact = pr.impact;
    return (
      impact.affected_backend.length +
      impact.affected_frontend.length +
      impact.affected_tests.length
    );
  }
}
