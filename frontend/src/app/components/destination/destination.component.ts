import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

import { BlogService } from '../../services/blog.service';
import { BucketListItem } from '../../models/post';

@Component({
  selector: 'app-destination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './destination.component.html',
  styleUrls: ['./destination.component.css'],
})
export class DestinationComponent implements OnInit, OnDestroy {
  isAdmin: boolean = true;
  newBucketItem: string = '';
  newEmoji: string = '';
  newLatitude: number = 0;
  newLongitude: number = 0;
  newCountry: string = '';
  newFunFact: string = '';
  newUniqueThing: string = '';

  bucketList: BucketListItem[] = [];
  chunkedList: BucketListItem[][] = [];
  isLoading: boolean = false;
  private userSub!: Subscription;
  private map: any;
  userId: any;

  constructor(
    private blogService: BlogService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    this.userId = user?.id;
    const currentUrl = this.router.url;
    this.isAdmin = user?.role === 'admin' && currentUrl.startsWith('/admin');

    this.route.queryParams.subscribe((params) => {
      const focusId = params['focus'];
      this.loadBucketList(focusId ? +focusId : undefined);
    });
  }

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  loadBucketList(focusId?: number) {
    this.isLoading = true;
    this.blogService.getBucketList().subscribe(
      (items) => {
        this.bucketList = items.map((item: any) => ({
          id: item.id ?? item.Id,
          name: item.name ?? item.Name,
          completed: !!(item.completed ?? item.Completed),
          emoji: item.emoji ?? item.Emoji ?? '❓',
          latitude: item.latitude ?? item.Latitude ?? 0,
          longitude: item.longitude ?? item.Longitude ?? 0,
          country: item.country ?? item.Country ?? 'Unknown',
          funFact: item.funfact ?? item.funFact ?? item.FunFact ?? '',
          uniqueThing:
            item.uniquething ?? item.uniqueThing ?? item.UniqueThing ?? '',

          isWishlist: this.userId
            ? !!(item.isWishlist ?? item.IsWishlist)
            : false,
        }));

        this.chunkedList = this.chunkArray(this.bucketList, 10);
        this.isLoading = false;
        this.initMap(focusId);
      },

      (error) => {
        console.error('Failed to load bucket list', error);
        this.isLoading = false;
      }
    );
  }

  addBucketItem() {
    const name = this.newBucketItem.trim();
    const country = this.newCountry.trim();
    if (!name || !country || !this.newEmoji) return;

    const item = {
      Name: name,
      Country: country,
      Latitude: this.newLatitude,
      Longitude: this.newLongitude,
      Emoji: this.newEmoji,
      FunFact: this.newFunFact.trim(),
      UniqueThing: this.newUniqueThing.trim(),
    };

    this.isLoading = true;
    this.blogService.addBucketListItem(item).subscribe({
      next: () => {
        this.newBucketItem = '';
        this.newEmoji = '';
        this.newLatitude = 0;
        this.newLongitude = 0;
        this.newCountry = '';
        this.newFunFact = '';
        this.newUniqueThing = '';
        this.loadBucketList();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to add bucket list item', err);
        this.isLoading = false;
      },
    });
  }

  autoFillCoordinates() {
    const country = this.newCountry.trim();
    if (!country) return;
    this.http
      .get<any[]>(
        `https://nominatim.openstreetmap.org/search?country=${country}&format=json`
      )
      .subscribe((results) => {
        if (results.length > 0) {
          this.newLatitude = parseFloat(results[0].lat);
          this.newLongitude = parseFloat(results[0].lon);
        } else {
          alert('Country not found.');
        }
      });
  }

  toggleItem(item: BucketListItem) {
    if (!this.isAdmin || item.id === undefined) return;

    const newStatus = item.completed;
    this.blogService.updateBucketListItem(item).subscribe({
      next: () => {
        item.completed = newStatus;
      },
      error: (err) => {
        console.error('Failed to update item', err);
        item.completed = !newStatus;
      },
    });
  }

  deleteBucketItem(id: number) {
    if (!id || !this.isAdmin) return;
    if (!confirm('Are you sure you want to delete this item?')) return;
    this.isLoading = true;
    this.blogService.deleteBucketListItem(id).subscribe({
      next: () => this.loadBucketList(),
      error: (err) => {
        console.error('Failed to delete bucket list item', err);
        this.isLoading = false;
      },
    });
  }

  chunkArray(arr: BucketListItem[], size: number): BucketListItem[][] {
    const result: BucketListItem[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  trackByItemId(index: number, item: BucketListItem): number {
    return item.id ?? -1;
  }

  generatePopupContent(item: BucketListItem, isAdmin: boolean): string {
    const isLoggedIn = !!this.userId;
    const isUser = isLoggedIn && !isAdmin;
    const showDetails = item.completed;

    const starHtml = isUser
      ? `<span class="wishlist-star" data-id="${item.id}" 
          style="position: absolute; right: -6px; top: -12px; font-size: 24px; cursor: pointer;">
        ${item.isWishlist ? '⭐' : '☆'}
      </span>`
      : '';

    return `
    <div class="popup-content" style="position: relative; width: 300px;">
      ${starHtml}
      <strong>${item.name}</strong>
      <div class="popup-country">${item.country}</div>
      ${
        showDetails && item.funFact
          ? `<div class="popup-funfact"><em>Fun Fact:</em> ${item.funFact}</div>`
          : ''
      }
      ${
        showDetails && item.uniqueThing
          ? `<div class="popup-unique"><em>Unique Thing:</em> ${item.uniqueThing}</div>`
          : ''
      }
      <div class="popup-status">
        ${item.completed ? '✅ Completed' : '❌ Not yet'}
      </div>
    </div>`;
  }

  bindWishlistStar(marker: any, item: BucketListItem) {
    setTimeout(() => {
      const star = document.querySelector(
        `.wishlist-star[data-id="${item.id}"]`
      ) as HTMLElement;

      if (!star) return;

      star.addEventListener('click', () => {
        const newStatus = !item.isWishlist;

        this.blogService
          .updateWishlist(this.userId, item.id!, newStatus)
          .subscribe({
            next: () => {
              item.isWishlist = newStatus;
              marker.setPopupContent(
                this.generatePopupContent(item, this.isAdmin)
              );
              this.bindWishlistStar(marker, item);
            },
          });
      });
    }, 0);
  }

  initMap(focusId?: number) {
    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('map', {
      zoomControl: false,
      minZoom: 2,
      maxBounds: [
        [-90, -180],
        [90, 180],
      ],
      maxBoundsViscosity: 1.0,
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.bucketList.forEach((item) => {
      if (item.latitude && item.longitude) {
        const marker = L.marker([item.latitude, item.longitude], {
          icon: L.divIcon({
            className: 'emoji-icon',
            html: `<span style="font-size: 24px;">${item.emoji}</span>`,
          }),
          draggable: this.isAdmin,
        }).addTo(this.map);

        marker.bindPopup(this.generatePopupContent(item, this.isAdmin));

        marker.on('popupopen', () => {
          if (!this.isAdmin) {
            this.bindWishlistStar(marker, item);
          }
        });

        if (focusId && item.id === focusId) {
          this.map.setView([item.latitude, item.longitude], 7, {
            animate: true,
          });
          marker.openPopup();
        }
      }
    });
  }
}
