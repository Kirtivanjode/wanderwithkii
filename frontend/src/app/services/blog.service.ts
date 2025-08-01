import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  Adventure,
  BucketListItem,
  CommentRequest,
  PostLikesResponse,
  WebsiteSection,
  WishlistDto,
} from '../models/post';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private baseUrl = 'https://wanderwithkii-g3wr.onrender.com/api';
  // private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  login(data: { username: string; password: string }) {
    return this.http.post<{ user: any; role: string }>(`${this.baseUrl}/auth`, {
      ...data,
      action: 'login',
    });
  }

  signUp(data: {
    username: string;
    password: string;
    email: string;
    phone: string;
  }) {
    return this.http.post<{ user: any; role: string }>(`${this.baseUrl}/auth`, {
      ...data,
      action: 'signup',
    });
  }

  adminlogin(credentials: {
    username: string;
    password: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/login`, credentials);
  }

  getImageUrl(id: number | null): SafeUrl {
    const url = id ? `${this.baseUrl}/images/${id}` : '';
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  getAllPosts(username?: string): Observable<any[]> {
    const url = username
      ? `${this.baseUrl}/posts?username=${encodeURIComponent(username)}`
      : `${this.baseUrl}/posts`;
    return this.http.get<any[]>(url);
  }

  getPostById(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/posts/${id}`);
  }

  createPost(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/posts`, formData);
  }

  updatePostWithImages(id: number, formData: FormData): Observable<string> {
    return this.http.put(`${this.baseUrl}/posts/${id}`, formData, {
      responseType: 'text',
    });
  }

  deletePost(id: number): Observable<string> {
    return this.http.delete(`${this.baseUrl}/posts/${id}`, {
      responseType: 'text',
    });
  }

  getComments(postId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/comments/${postId}`);
  }

  addComment(comment: CommentRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/comments`, comment);
  }

  deleteComment(commentId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/comments/${commentId}`
    );
  }

  likePost(
    postId: number,
    username: string
  ): Observable<{ likes: number; isLiked: boolean }> {
    return this.http.post<{ likes: number; isLiked: boolean }>(
      `${this.baseUrl}/posts/${postId}/like`,
      { username }
    );
  }

  getPostLikes(postId: number): Observable<PostLikesResponse> {
    return this.http.get<PostLikesResponse>(
      `${this.baseUrl}/posts/${postId}/likes`
    );
  }

  // --- Food Items ---
  getAllFoodItems(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/fooditems`);
  }

  getFoodById(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/fooditems/${id}`);
  }

  addFoodItem(item: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/fooditems`, item);
  }

  updateFoodItem(id: number, data: FormData): Observable<any> {
    return this.http.put(`${this.baseUrl}/fooditems/${id}`, data);
  }

  deleteFoodItem(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/fooditems/${id}`);
  }

  // --- Bucket List ---
  getBucketList(): Observable<BucketListItem[]> {
    return this.http.get<BucketListItem[]>(`${this.baseUrl}/bucketlist`);
  }

  updateWishlist(userId: number, bucketItemId: number, isWishlist: boolean) {
    return this.http.post(`${this.baseUrl}/wishlist`, {
      userId,
      bucketItemId,
      isWishlist,
    });
  }

  addBucketListItem(item: {
    Name: string;
    Country: string;
    Latitude: number;
    Longitude: number;
    Emoji: string;
    FunFact: string;
    UniqueThing: string;
  }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/bucketlist`,
      item
    );
  }

  updateBucketListItem(item: BucketListItem): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.baseUrl}/bucketlist/${item.id}`,
      item
    );
  }

  deleteBucketListItem(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/bucketlist/${id}`
    );
  }

  getUserWishlist(userId: number): Observable<BucketListItem[]> {
    return this.http.get<any[]>(`${this.baseUrl}/wishlist/${userId}`).pipe(
      map((items) =>
        items.map((item) => ({
          id: item.id,
          name: item.name,
          completed: false, // or item.completed if exists in DB
          emoji: item.emoji,
          latitude: item.latitude,
          longitude: item.longitude,
          funFact: item.funfact || '',
          uniqueThing: item.uniquething || '',
          country: item.country,
          isWishlist: true,
        }))
      )
    );
  }

  getAdventures(): Observable<Adventure[]> {
    return this.http.get<Adventure[]>(`${this.baseUrl}/adventures`);
  }

  addAdventure(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/adventures`, formData);
  }

  updateAdventure(id: number, data: FormData): Observable<any> {
    return this.http.put(`${this.baseUrl}/adventures/${id}`, data);
  }

  deleteAdventure(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/adventures/${id}`);
  }

  updateAdventureFormData(id: number, formData: FormData): Observable<any> {
    return this.http.put(`${this.baseUrl}/adventures/${id}`, formData);
  }

  getSections(): Observable<WebsiteSection[]> {
    console.log('Inside BlogService.getSections()');
    return this.http.get<WebsiteSection[]>(`${this.baseUrl}/home`);
  }

  updateSection(
    id: number,
    section: WebsiteSection,
    file: File | undefined
  ): Observable<any> {
    const formData = new FormData();
    formData.append('title', section.title);
    formData.append('description', section.description);
    formData.append('content1', section.content1);
    formData.append('content2', section.content2);
    if (file) {
      formData.append('image', file, file.name);
    }

    return this.http.put(`${this.baseUrl}/home/${id}`, formData).pipe(
      map((response: any) => {
        console.log('API Response:', response); // Log the entire response for debugging
        const imageId = response.imageId;
        return { imageId: imageId }; // Return the extracted imageId
      })
    );
  }

  deleteSection(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/home/${id}`);
  }

  getLikedPosts(username: string) {
    return this.http.get<any[]>(`${this.baseUrl}/liked-posts/${username}`);
  }

  getUserComments(username: string) {
    return this.http.get<any[]>(`${this.baseUrl}/user-comments/${username}`);
  }

  updateUserSettings(userId: number, user: any) {
    return this.http.put<{ message: string }>(
      `${this.baseUrl}/users/${userId}`,
      user
    );
  }
  changePassword(userId: number, oldPassword: string, newPassword: string) {
    return this.http.put<{ message: string }>(`${this.baseUrl}/auth/password`, {
      userId,
      oldPassword,
      newPassword,
    });
  }
  deleteAccount(userId: number) {
    return this.http.delete(`${this.baseUrl}/users/${userId}`);
  }
}
