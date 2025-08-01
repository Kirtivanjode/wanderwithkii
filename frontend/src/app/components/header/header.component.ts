import { Component, HostListener, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  isScrolled = false;
  isLoggedIn = false;
  username: string | null = null;
  menuOpen = false;
  showSettings = false;

  user = {
    name: 'Kirti',
    email: 'kirti@example.com',
    bio: 'Travel lover 🌏',
  };

  activeTab: 'personal' | 'password' | 'theme' = 'personal';

  top = 100;
  left = 100;
  zIndex = 10;

  private dragging = false;
  private offsetX = 0;
  private offsetY = 0;

  startDrag(event: MouseEvent) {
    this.dragging = true;
    this.offsetX = event.clientX - this.left;
    this.offsetY = event.clientY - this.top;
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.dragging) {
      this.left = event.clientX - this.offsetX;
      this.top = event.clientY - this.offsetY;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.user-menu');

    if (!clickedInside) {
      this.menuOpen = false;
    }
  }

  constructor(
    public imageService: BlogService,
    private router: Router,
    public authService: AuthService
  ) {}
  isAdmin = false;

  ngOnInit(): void {
    this.authService.user$.subscribe((user) => {
      this.isLoggedIn = !!user;
      this.username = user?.username;
      this.isAdmin = user?.role === 'admin';
    });
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  openSettings() {
    this.router.navigate(['/settings']);
  }

  openLogin() {
    const currentUrl = this.router.url;
    this.router.navigate(['/formpage'], {
      queryParams: { returnUrl: currentUrl },
    });
  }

  openAdminLogin(): void {
    const currentUrl = this.router.url;
    this.router.navigate(['/admin/formpage'], {
      queryParams: { returnUrl: currentUrl },
    });
  }

  logClick(link: string) {
    console.log(`${link} clicked`);
  }
}
