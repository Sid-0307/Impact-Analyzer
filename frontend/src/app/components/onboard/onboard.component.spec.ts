import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnboardComponent } from './onboard.component';

describe('OnboardComponent', () => {
  let component: OnboardComponent;
  let fixture: ComponentFixture<OnboardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OnboardComponent]
    });
    fixture = TestBed.createComponent(OnboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
