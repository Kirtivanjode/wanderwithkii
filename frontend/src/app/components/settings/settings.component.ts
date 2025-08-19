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
  activeTab = '';

  user = {
    id: 0,
    username: '',
    email: '',
    phone: '',
    password: '',
  };

  wishlist: any[] = [];
  likedPosts: any[] = [];
  commentedPosts: any[] = [];
  showFullSettings = true;
  sidebarOpen: boolean = true;
  currentTheme = 'light';
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  isLoggedIn = false;
  username: string | null = null;
  groupedComments: any[] = [];

  showPassword: boolean = false;

  constructor(
    public blogService: BlogService,
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
    this.showFullSettings = false;
  }

  goBackToSettings() {
    this.activeTab = '';
    this.showFullSettings = true;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  saveSettings() {
    this.blogService.updateUserSettings(this.user.id, this.user).subscribe({
      next: () => {
        sessionStorage.setItem('user', JSON.stringify(this.user));
        this.toastr.success('Settings saved to database!', 'Success');
      },
      error: (err) => {
        console.error('Update error:', err);
        this.toastr.error('Failed to save settings.', 'Error');
      },
    });
  }

  changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.toastr.error('New passwords do not match!', 'Error');
      return;
    }

    this.blogService
      .changePassword(this.user.id, this.oldPassword, this.newPassword)
      .subscribe({
        next: () => {
          this.toastr.success('Password updated successfully!', 'Success');
          this.oldPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
        },
        error: (err) => {
          console.error('Password update failed', err);
          this.toastr.error('Old password incorrect, update failed.', 'Error');
        },
      });
  }

  checkLogin() {
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.isLoggedIn = true;
      this.username = user.username;
    } else {
      this.isLoggedIn = false;
      this.username = null;
    }
  }

  logout() {
    this.authService.clearUser();
    this.checkLogin();
    this.router.navigate(['/']);
  }

  deleteAccount() {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );
    if (confirmed && this.user?.id) {
      this.blogService.deleteAccount(this.user.id).subscribe({
        next: () => {
          this.toastr.success('Account deleted successfully');
          this.logout(); // Clear session and redirect
        },
        error: () => {
          this.toastr.error('Failed to delete account');
        },
      });
    }
  }

  loadUserData() {
    // ✅ Wishlist fetched by username
    this.blogService.getUserWishlist(this.user.username).subscribe({
      next: (res) => {
        console.log('Raw wishlist data:', res);
        this.wishlist = res.map((item: any) => ({
          id: item.id,
          name: item.name,
          country: item.country,
          latitude: item.latitude,
          longitude: item.longitude,
          emoji: item.emoji,
          uniqueThing: item.uniquething || '',
          funFact: item.funfact || '',
          isWishlist: item.iswishlist ?? true,
          completed: item.completed ?? false,
        }));
        console.log('Mapped Wishlist:', this.wishlist);
      },
      error: (err) => console.error('Wishlist fetch error', err),
    });

    // ✅ Liked posts by username
    this.blogService.getLikedPosts(this.user.username).subscribe({
      next: (res) => (this.likedPosts = res),
      error: (err) => console.error('Liked posts fetch error', err),
    });

    // ✅ Comments grouped by post
    this.blogService.getUserComments(this.user.username).subscribe({
      next: (comments) => {
        const groupedMap = new Map<number, any>();

        for (const comment of comments) {
          const postId = comment.post_id;

          if (!groupedMap.has(postId)) {
            groupedMap.set(postId, {
              postId: postId,
              postTitle: comment.posttitle,
              comments: [],
            });
          }

          groupedMap.get(postId).comments.push({
            message: comment.message,
            comment_date: comment.comment_date,
          });
        }

        this.groupedComments = Array.from(groupedMap.values());
      },
      error: (err) => console.error('User comments fetch error', err),
    });
  }
}
