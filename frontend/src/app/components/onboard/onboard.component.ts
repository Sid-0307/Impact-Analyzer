import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';
import { OnboardRequest } from '../../models/types';

@Component({
  selector: 'app-onboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="container">
      <mat-card>
        <mat-card-header>
          <button mat-icon-button routerLink="/" class="back-button">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <mat-card-title>
            <mat-icon>cloud_upload</mat-icon>
            Onboard Repositories
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <p class="description">
            Enter the GitHub URLs for your Spring Boot backend and Angular
            frontend repositories. The system will parse both repos and build a
            dependency graph.
          </p>

          <form #onboardForm="ngForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Backend Repository URL</mat-label>
              <input
                matInput
                [(ngModel)]="request.backend_repo_url"
                name="backend"
                placeholder="https://github.com/owner/spring-boot-backend"
                required
              />
              <mat-icon matPrefix>code</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Frontend Repository URL</mat-label>
              <input
                matInput
                [(ngModel)]="request.frontend_repo_url"
                name="frontend"
                placeholder="https://github.com/owner/angular-frontend"
                required
              />
              <mat-icon matPrefix>web</mat-icon>
            </mat-form-field>

            <div class="actions">
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="!onboardForm.valid || loading"
              >
                <mat-icon *ngIf="!loading">send</mat-icon>
                <mat-spinner *ngIf="loading" diameter="20"></mat-spinner>
                {{ loading ? 'Onboarding...' : 'Onboard Repositories' }}
              </button>

              <button
                mat-button
                type="button"
                routerLink="/"
                [disabled]="loading"
              >
                Cancel
              </button>
            </div>
          </form>

          <div *ngIf="loading" class="loading-message">
            <mat-spinner diameter="40"></mat-spinner>
            <p>This may take a few minutes. Please wait...</p>
          </div>

          <div *ngIf="result" class="result-card">
            <h3>✅ Onboarding Successful!</h3>
            <ul>
              <li><strong>Backend:</strong> {{ result.backend_repo }}</li>
              <li><strong>Frontend:</strong> {{ result.frontend_repo }}</li>
              <li><strong>Total Nodes:</strong> {{ result.total_nodes }}</li>
              <li><strong>Total Edges:</strong> {{ result.total_edges }}</li>
              <li><strong>Endpoints:</strong> {{ result.endpoints }}</li>
            </ul>
            <button mat-raised-button color="accent" routerLink="/">
              View Dashboard
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
      }

      mat-card-header {
        position: relative;
      }

      .back-button {
        position: absolute;
        top: -10px;
        left: -10px;
      }

      mat-card-title {
        display: flex;
        align-items: center;
        gap: 10px;
        padding-left: 40px;
      }

      .description {
        color: #666;
        margin: 20px 0;
      }

      .full-width {
        width: 100%;
        margin-bottom: 15px;
      }

      .actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }

      .actions button {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .loading-message {
        text-align: center;
        padding: 40px;
        color: #666;
      }

      .loading-message mat-spinner {
        margin: 0 auto 20px;
      }

      .result-card {
        margin-top: 30px;
        padding: 20px;
        background: #e8f5e9;
        border-radius: 8px;
        border-left: 4px solid #4caf50;
      }

      .result-card h3 {
        margin-top: 0;
        color: #2e7d32;
      }

      .result-card ul {
        margin: 15px 0;
      }

      .result-card li {
        margin: 8px 0;
      }
    `,
  ],
})
export class OnboardComponent {
  request: OnboardRequest = {
    backend_repo_url: '',
    frontend_repo_url: '',
  };

  loading = false;
  result: any = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  onSubmit(): void {
    this.loading = true;
    this.result = null;

    this.apiService.onboardRepositories(this.request).subscribe({
      next: (response:any) => {
        this.loading = false;
        this.result = response;
        this.snackBar.open('Repositories onboarded successfully!', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar'],
        });
      },
      error: (err:any) => {
        this.loading = false;
        this.snackBar.open(
          `Onboarding failed: ${err.error?.detail || err.message}`,
          'Close',
          {
            duration: 5000,
            panelClass: ['error-snackbar'],
          }
        );
      },
    });
  }
}
