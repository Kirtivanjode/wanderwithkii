import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  user$ = this.userSubject.asObservable();

  setUser(user: any) {
    sessionStorage.setItem('user', JSON.stringify(user));
    sessionStorage.setItem('token', user.token);
    sessionStorage.setItem('role', user.role);
    this.userSubject.next(user);
  }

  getUserFromStorage() {
    const userStr = sessionStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  clearUser() {
    sessionStorage.clear();
    this.userSubject.next(null);
  }

  getUsername(): string | null {
    const userStr = sessionStorage.getItem('user');
    return userStr ? JSON.parse(userStr).username : null;
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem('token');
  }

  isAdmin(): boolean {
    return sessionStorage.getItem('role') === 'admin';
  }

  isUser(): boolean {
    return sessionStorage.getItem('role') === 'user';
  }
}
