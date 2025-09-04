import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class SettingsComponent implements OnInit {
  activeTab = 'personal';
  showOldPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  user = {
    id: 0,
    username: '',
    email: '',
    phone: '',
    password: '',
  };

  wishlist: any[] = [];
  likedPosts: any[] = [];
  groupedComments: any[] = [];
  sidebarOpen = true;
  showPassword = false;
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  constructor(
    private blogService: BlogService,
    private toastr: ToastrService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      this.user = {
        id: userData.id,
        username: userData.username || '',
        email: userData.email || '',
        phone: userData.phone || '',
        password: userData.password || '',
      };
      this.loadUserData();
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  saveSettings() {
    this.blogService.updateUserSettings(this.user.id, this.user).subscribe({
      next: () => {
        sessionStorage.setItem('user', JSON.stringify(this.user));
        this.toastr.success('Settings saved successfully!', 'Success');
      },
      error: (err) => {
        console.error('Update error:', err);
        this.toastr.error('Failed to save settings', 'Error');
      },
    });
  }

  changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.toastr.error('Passwords do not match', 'Error');
      return;
    }
    this.blogService
      .changePassword(this.user.id, this.oldPassword, this.newPassword)
      .subscribe({
        next: () => {
          this.toastr.success('Password updated!', 'Success');
          this.oldPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
        },
        error: (err) => {
          console.error('Password update failed', err);
          this.toastr.error('Old password incorrect', 'Error');
        },
      });
  }

  logout() {
    this.authService.clearUser();
    this.router.navigate(['/']);
  }

  deleteAccount() {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This cannot be undone.'
    );
    if (confirmed && this.user.id) {
      this.blogService.deleteAccount(this.user.id).subscribe({
        next: () => {
          this.toastr.success('Account deleted');
          this.logout();
        },
        error: () => this.toastr.error('Failed to delete account'),
      });
    }
  }

  loadUserData() {
    this.blogService.getUserWishlist(this.user.username).subscribe({
      next: (res) =>
        (this.wishlist = res.map((item: any) => ({
          id: item.id,
          name: item.name,
          country: item.country,
          emoji: item.emoji,
        }))),
      error: (err) => console.error('Wishlist error', err),
    });

    this.blogService.getLikedPosts(this.user.username).subscribe({
      next: (res) => (this.likedPosts = res),
      error: (err) => console.error('Liked posts error', err),
    });

    this.blogService.getUserComments(this.user.username).subscribe({
      next: (comments) => {
        const groupedMap = new Map<number, any>();
        comments.forEach((c: any) => {
          if (!groupedMap.has(c.post_id)) {
            groupedMap.set(c.post_id, {
              postTitle: c.posttitle,
              comments: [],
            });
          }
          groupedMap.get(c.post_id).comments.push({
            message: c.message,
            comment_date: c.comment_date,
          });
        });
        this.groupedComments = Array.from(groupedMap.values());
      },
      error: (err) => console.error('Comments fetch error', err),
    });
  }

  trackById(index: number, item: any) {
    return item.id;
  }
}
