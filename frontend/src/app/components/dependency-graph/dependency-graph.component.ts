import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { ApiService } from '../../services/api.service';
import { DependencyGraph, Repository } from '../../models/types';

@Component({
  selector: 'app-dependency-graph',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    MatButtonToggleModule,
    FormsModule,
  ],
  template: `
    <div class="container">
      <mat-card class="controls-card">
        <mat-card-content>
          <div class="controls-header">
            <button mat-icon-button routerLink="/" class="back-button">
              <mat-icon>arrow_back</mat-icon>
            </button>

            <h2>
              <mat-icon>hub</mat-icon>
              Dependency Graph Visualization
            </h2>

            <div class="spacer"></div>

            <mat-button-toggle-group
              [(ngModel)]="viewMode"
              (change)="onViewModeChange()"
            >
              <mat-button-toggle value="all">
                <mat-icon>view_module</mat-icon>
                All Dependencies
              </mat-button-toggle>
              <mat-button-toggle value="cross-repo">
                <mat-icon>swap_horiz</mat-icon>
                Cross-Repo Only
              </mat-button-toggle>
              <mat-button-toggle value="intra-repo">
                <mat-icon>account_tree</mat-icon>
                Intra-Repo Only
              </mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <div class="controls-actions">
            <mat-form-field appearance="outline" class="repo-selector">
              <mat-label>Repository</mat-label>
              <mat-select
                [(ngModel)]="selectedRepo"
                (selectionChange)="onRepoChange()"
              >
                <mat-option
                  *ngFor="let repo of repositories"
                  [value]="repo.name"
                >
                  <mat-icon>{{
                    repo.type === 'backend' ? 'code' : 'web'
                  }}</mat-icon>
                  {{ repo.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-raised-button color="primary" (click)="resetZoom()">
              <mat-icon>zoom_out_map</mat-icon>
              Reset View
            </button>

            <button mat-raised-button (click)="togglePhysics()">
              <mat-icon>{{ physicsEnabled ? 'pause' : 'play_arrow' }}</mat-icon>
              {{ physicsEnabled ? 'Freeze' : 'Animate' }}
            </button>

            <button mat-raised-button color="accent" (click)="exportGraph()">
              <mat-icon>download</mat-icon>
              Export
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Stats Cards -->
      <div class="stats-grid" *ngIf="graph">
        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #e3f2fd;">
            <mat-icon style="color: #2196f3;">hub</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ graph.nodes.length }}</div>
            <div class="stat-label">Total Nodes</div>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #f3e5f5;">
            <mat-icon style="color: #9c27b0;">link</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ graph.edges.length }}</div>
            <div class="stat-label">Total Edges</div>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #e8f5e9;">
            <mat-icon style="color: #4caf50;">swap_horiz</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ crossRepoCount }}</div>
            <div class="stat-label">Cross-Repo Links</div>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #fff3e0;">
            <mat-icon style="color: #ff9800;">api</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ graph.endpoints?.length || 0 }}</div>
            <div class="stat-label">API Endpoints</div>
          </div>
        </mat-card>
      </div>

      <!-- Graph Canvas -->
      <mat-card class="graph-card">
        <mat-card-content>
          <div #graphContainer class="graph-container"></div>

          <div class="graph-legend">
            <div class="legend-section">
              <h4>Node Types:</h4>
              <div class="legend-items">
                <div class="legend-item" *ngFor="let type of nodeTypes">
                  <div class="legend-dot" [style.background]="type.color"></div>
                  <mat-icon class="legend-icon">{{ type.icon }}</mat-icon>
                  <span>{{ type.label }}</span>
                </div>
              </div>
            </div>

            <div class="legend-section">
              <h4>Edge Types:</h4>
              <div class="legend-items">
                <div class="legend-item" *ngFor="let edge of edgeTypes">
                  <div
                    class="legend-line"
                    [style.background]="edge.color"
                  ></div>
                  <span>{{ edge.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Selected Node Info -->
      <mat-card class="info-card" *ngIf="selectedNodeInfo">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>info</mat-icon>
            Selected Node Details
          </mat-card-title>
          <button mat-icon-button (click)="selectedNodeInfo = null">
            <mat-icon>close</mat-icon>
          </button>
        </mat-card-header>
        <mat-card-content>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">ID:</span>
              <code>{{ selectedNodeInfo.id }}</code>
            </div>
            <div class="info-row">
              <span class="info-label">Type:</span>
              <mat-chip
                [style.background]="getNodeColor(selectedNodeInfo.type)"
              >
                {{ selectedNodeInfo.type }}
              </mat-chip>
            </div>
            <div class="info-row">
              <span class="info-label">Repository:</span>
              <mat-chip>{{ selectedNodeInfo.repo }}</mat-chip>
            </div>
            <div class="info-row">
              <span class="info-label">File:</span>
              <code class="file-path">{{ selectedNodeInfo.file }}</code>
            </div>
            <div class="info-row" *ngIf="selectedNodeInfo.endpoint">
              <span class="info-label">Endpoint:</span>
              <code
                >{{ selectedNodeInfo.endpoint.method }}
                {{ selectedNodeInfo.endpoint.path }}</code
              >
            </div>
          </div>

          <div class="connections" *ngIf="getNodeConnections().length > 0">
            <h4>Connections:</h4>
            <mat-chip-set>
              <mat-chip *ngFor="let conn of getNodeConnections()">
                {{ conn }}
              </mat-chip>
            </mat-chip-set>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 20px;
        max-width: 1800px;
        margin: 0 auto;
      }

      .controls-card {
        margin-bottom: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .controls-header {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 20px;
      }

      .back-button {
        color: white;
      }

      .controls-header h2 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 22px;
      }

      .spacer {
        flex: 1;
      }

      .controls-actions {
        display: flex;
        align-items: center;
        gap: 15px;
        flex-wrap: wrap;
      }

      .repo-selector {
        min-width: 300px;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
      }

      .stat-card {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 20px !important;
        transition: transform 0.2s;
      }

      .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
      }

      .stat-icon {
        width: 50px;
        height: 50px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .stat-icon mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      .stat-content {
        flex: 1;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 600;
        line-height: 1;
        margin-bottom: 5px;
      }

      .stat-label {
        font-size: 13px;
        color: #666;
      }

      .graph-card {
        position: relative;
      }

      .graph-container {
        width: 100%;
        height: 700px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        background: #fafafa;
        position: relative;
      }

      .graph-legend {
        display: flex;
        gap: 40px;
        margin-top: 20px;
        padding: 20px;
        background: #f5f5f5;
        border-radius: 8px;
      }

      .legend-section h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #666;
      }

      .legend-items {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }

      .legend-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .legend-line {
        width: 30px;
        height: 3px;
        border-radius: 2px;
      }

      .legend-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #666;
      }

      .info-card {
        margin-top: 20px;
        border-left: 4px solid #2196f3;
      }

      .info-card mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .info-card mat-card-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .info-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .info-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .info-label {
        font-weight: 600;
        min-width: 100px;
        color: #666;
      }

      .file-path {
        background: #f5f5f5;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        word-break: break-all;
      }

      .connections {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #e0e0e0;
      }

      .connections h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #666;
      }

      code {
        background: #e8e8e8;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
      }

      @media (max-width: 768px) {
        .stats-grid {
          grid-template-columns: 1fr;
        }

        .controls-actions {
          flex-direction: column;
          align-items: stretch;
        }

        .repo-selector {
          width: 100%;
        }
      }
    `,
  ],
})
export class DependencyGraphComponent implements OnInit, AfterViewInit {
  @ViewChild('graphContainer', { static: false }) graphContainer!: ElementRef;

  repositories: Repository[] = [];
  selectedRepo: string = '';
  selectedNodeInfo: any = null;
  viewMode: 'all' | 'cross-repo' | 'intra-repo' = 'all';
  physicsEnabled: boolean = true;
  crossRepoCount: number = 0;

  private network: Network | null = null;
  graph: DependencyGraph | null = null;

  nodeTypes = [
    { label: 'Controller', color: '#2196f3', icon: 'router' },
    { label: 'Service', color: '#4caf50', icon: 'settings' },
    { label: 'Angular Service', color: '#ff9800', icon: 'build' },
    { label: 'Component', color: '#9c27b0', icon: 'web' },
    { label: 'Test', color: '#f44336', icon: 'bug_report' },
  ];

  edgeTypes = [
    { label: 'Method Call', color: '#666' },
    { label: 'HTTP Call (Cross-Repo)', color: '#2196f3' },
    { label: 'Test Link', color: '#f44336' },
  ];

  constructor(private apiService: ApiService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadRepositories();

    this.route.queryParams.subscribe((params) => {
      if (params['repo']) {
        this.selectedRepo = params['repo'];
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.selectedRepo) {
      this.loadGraph();
    }
  }

  loadRepositories(): void {
    this.apiService.getRepositories().subscribe({
      next: (repos) => {
        this.repositories = repos;
        if (!this.selectedRepo && repos.length > 0) {
          this.selectedRepo = repos[0].name;
          this.loadGraph();
        }
      },
      error: (err) => {
        console.error('Error loading repositories:', err);
      },
    });
  }

  onRepoChange(): void {
    this.loadGraph();
  }

  onViewModeChange(): void {
    this.renderGraph();
  }

  loadGraph(): void {
    if (!this.selectedRepo) return;

    this.apiService.getDependencyGraph(this.selectedRepo).subscribe({
      next: (graph) => {
        this.graph = graph;
        this.calculateCrossRepoCount();
        this.renderGraph();
      },
      error: (err) => {
        console.error('Error loading graph:', err);
      },
    });
  }

  calculateCrossRepoCount(): void {
    if (!this.graph) return;
    this.crossRepoCount = this.graph.edges.filter(
      (e) => e.repo === 'cross_repo' || e.type === 'http_call'
    ).length;
  }

  renderGraph(): void {
    if (!this.graph || !this.graphContainer) return;

    let filteredEdges = this.graph.edges;

    if (this.viewMode === 'cross-repo') {
      filteredEdges = this.graph.edges.filter(
        (e) => e.repo === 'cross_repo' || e.type === 'http_call'
      );
    } else if (this.viewMode === 'intra-repo') {
      filteredEdges = this.graph.edges.filter(
        (e) => e.repo !== 'cross_repo' && e.type !== 'http_call'
      );
    }

    const nodes = new DataSet(
      this.graph.nodes.map((node) => ({
        id: node.id,
        label: this.getNodeLabel(node.id),
        color: {
          background: this.getNodeColor(node.type),
          border: this.darkenColor(this.getNodeColor(node.type)),
          highlight: {
            background: this.lightenColor(this.getNodeColor(node.type)),
            border: this.getNodeColor(node.type),
          },
        },
        title: `${node.id}\n${node.file}\nRepo: ${node.repo || 'unknown'}`,
        shape: 'dot',
        size: 25,
        font: {
          size: 14,
          color: '#333',
          face: 'Roboto',
        },
        borderWidth: 3,
        borderWidthSelected: 5,
      }))
    );

    const edges = new DataSet(
      filteredEdges.map((edge, index) => ({
        id: index,
        from: edge.from,
        to: edge.to,
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
        color: {
          color: this.getEdgeColor(edge.type),
          highlight: this.lightenColor(this.getEdgeColor(edge.type)),
        },
        width: edge.type === 'http_call' ? 4 : 2,
        dashes: edge.type === 'tests',
        smooth: {
          type: 'cubicBezier',
          roundness: 0.5,
        },
      }))
    );

    const data = { nodes, edges };

    const options = {
      physics: {
        enabled: this.physicsEnabled,
        stabilization: {
          iterations: 300,
          fit: true,
        },
        barnesHut: {
          gravitationalConstant: -10000,
          centralGravity: 0.3,
          springLength: 200,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.5,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        dragNodes: true,
        dragView: true,
        zoomView: true,
        selectable: true,
        multiselect: false,
      },
      nodes: {
        borderWidth: 3,
        borderWidthSelected: 5,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.2)',
          size: 10,
          x: 2,
          y: 2,
        },
      },
      edges: {
        width: 2,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.1)',
          size: 5,
        },
      },
      layout: {
        improvedLayout: true,
        hierarchical: false,
      },
    };

    this.network = new Network(
      this.graphContainer.nativeElement,
      data as any,
      options
    );

    this.network.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = this.graph?.nodes.find((n) => n.id === nodeId);
        this.selectedNodeInfo = node;
      } else {
        this.selectedNodeInfo = null;
      }
    });

    this.network.on('doubleClick', (params: any) => {
      if (params.nodes.length > 0) {
        this.network?.focus(params.nodes[0], {
          scale: 1.5,
          animation: {
            duration: 1000,
            easingFunction: 'easeInOutQuad',
          },
        });
      }
    });
  }

  getNodeLabel(id: string): string {
    const parts = id.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : id;
  }

  getNodeColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      controller: '#2196f3',
      service: '#4caf50',
      angular_service: '#ff9800',
      angular_component: '#9c27b0',
      test: '#f44336',
      angular_class: '#795548',
    };
    return colorMap[type] || '#9e9e9e';
  }

  getEdgeColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      calls: '#666',
      tests: '#f44336',
      http_call: '#2196f3',
    };
    return colorMap[type] || '#999';
  }

  darkenColor(color: string): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = -40;
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  lightenColor(color: string): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = 60;
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  resetZoom(): void {
    if (this.network) {
      this.network.fit({
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuad',
        },
      });
    }
  }

  togglePhysics(): void {
    this.physicsEnabled = !this.physicsEnabled;
    if (this.network) {
      this.network.setOptions({ physics: { enabled: this.physicsEnabled } });
    }
  }

  exportGraph(): void {
    if (!this.graph) return;
    const dataStr = JSON.stringify(this.graph, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dependency-graph-${this.selectedRepo}.json`;
    link.click();
  }

  getNodeConnections(): string[] {
    if (!this.selectedNodeInfo || !this.graph) return [];

    const connections: string[] = [];
    const nodeId = this.selectedNodeInfo.id;

    this.graph.edges.forEach((edge) => {
      if (edge.from === nodeId) {
        connections.push(`→ ${edge.to} (${edge.type})`);
      }
      if (edge.to === nodeId) {
        connections.push(`← ${edge.from} (${edge.type})`);
      }
    });

    return connections;
  }
}
