import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormpageComponent } from './formpage.component';

describe('FormpageComponent', () => {
  let component: FormpageComponent;
  let fixture: ComponentFixture<FormpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormpageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
