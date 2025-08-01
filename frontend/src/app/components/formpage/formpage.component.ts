import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-formpage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './formpage.component.html',
  styleUrls: ['./formpage.component.css'],
})
export class FormpageComponent implements OnInit {
  showLogin = true;
  returnUrl: string = '/';

  loginData = { username: '', password: '' };
  signUpData = { username: '', password: '', email: '', phone: '' };

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private blogService: BlogService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.returnUrl = params['returnUrl'] || '/';
    });
  }

  switchForm() {
    this.showLogin = !this.showLogin;
  }

  login() {
    this.blogService.login(this.loginData).subscribe({
      next: (res) => {
        const user = {
          ...res.user,
          role: res.role || 'user',
        };
        this.authService.setUser(user);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => this.toastr.error(err.error?.message || 'Login failed'),
    });
  }

  signUp() {
    this.blogService.signUp(this.signUpData).subscribe({
      next: (res) => {
        const user = {
          ...res.user,
          role: res.role || 'user',
        };
        this.authService.setUser(user);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => this.toastr.error(err.error?.message || 'Signup failed'),
    });
  }
}
