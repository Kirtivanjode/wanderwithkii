import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminFormpageComponent } from './admin-formpage.component';

describe('AdminFormpageComponent', () => {
  let component: AdminFormpageComponent;
  let fixture: ComponentFixture<AdminFormpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminFormpageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminFormpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
