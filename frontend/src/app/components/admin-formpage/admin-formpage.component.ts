import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BlogService } from '../../services/blog.service';
import { ToastrService } from 'ngx-toastr';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-formpage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-formpage.component.html',
  styleUrls: ['./admin-formpage.component.css'],
})
export class AdminFormpageComponent {
  loginData = { username: '', password: '' };
  returnUrl = '/admin/blog';

  private router = inject(Router);
  private authService = inject(AuthService);
  private blogService = inject(BlogService);
  private toastr = inject(ToastrService);

  constructor() {
    if (this.authService.isLoggedIn() && this.authService.isAdmin()) {
      this.router.navigateByUrl('/admin/home');
    }
  }

  ngOnInit() {
    if (this.authService.isLoggedIn() && this.authService.isAdmin()) {
      this.router.navigateByUrl('/admin/home');
    }
  }

  login() {
    this.blogService.adminlogin(this.loginData).subscribe({
      next: (res) => {
        console.log('✅ Login success:', res);
        const userWithRole = { ...res.user, role: 'admin' };
        this.authService.setUser({ ...userWithRole, token: res.token });

        setTimeout(() => {
          this.router.navigateByUrl(this.returnUrl);
        }, 100);
      },
      error: (err) => {
        console.error('❌ Login error:', err);
        this.toastr.error(err.error?.message || 'Admin login failed');
      },
    });
  }

  closeModal() {
    this.router.navigateByUrl('/');
  }
}
