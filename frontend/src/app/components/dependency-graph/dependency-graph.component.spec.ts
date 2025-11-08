import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DependencyGraphComponent } from './dependency-graph.component';

describe('DependencyGraphComponent', () => {
  let component: DependencyGraphComponent;
  let fixture: ComponentFixture<DependencyGraphComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DependencyGraphComponent]
    });
    fixture = TestBed.createComponent(DependencyGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
