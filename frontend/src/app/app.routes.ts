import { Routes } from '@angular/router';
import { PrListComponent } from './components/pr-list/pr-list.component';
import { PrDetailComponent } from './components/pr-detail/pr-detail.component';
import { DependencyGraphComponent } from './components/dependency-graph/dependency-graph.component';
import { OnboardComponent } from './components/onboard/onboard.component';

export const routes: Routes = [
  { path: '', component: PrListComponent },
  { path: 'pr/:id', component: PrDetailComponent },
  { path: 'graph', component: DependencyGraphComponent },
  { path: 'onboard', component: OnboardComponent },
  { path: '**', redirectTo: '' },
];
