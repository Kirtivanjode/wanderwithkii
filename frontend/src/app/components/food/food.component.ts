import { Component, OnInit } from '@angular/core';
import { BlogService } from '../../services/blog.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Food } from '../../models/post';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-food',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './food.component.html',
  styleUrls: ['./food.component.css'],
})
export class FoodComponent implements OnInit {
  isAdmin = false;
  foodItems: Food[] = [];
  editingId: number | null = null;
  addingNew = false;

  form: {
    name: string;
    description: string;
    location: string;
    rating: number | null;
    imageFile: File | null;
    imageName: string;
  } = {
    name: '',
    description: '',
    location: '',
    rating: 1,
    imageFile: null,
    imageName: '',
  };

  constructor(
    private blogService: BlogService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  item = {
    Rating: 3,
  };

  getStars(): number[] {
    return Array(5).fill(0);
  }

  setRating(newRating: number): void {
    this.item.Rating = newRating;
    console.log('New rating set to:', newRating);
  }

  ngOnInit(): void {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const currentUrl = this.router.url;

    this.isAdmin = user?.role === 'admin' && currentUrl.startsWith('/admin');

    console.log('Admin check:', this.isAdmin, 'URL:', currentUrl);

    this.fetchFoods();
  }

  fetchFoods(): void {
    this.blogService.getAllFoodItems().subscribe((data: any[]) => {
      console.log('Fetched Food:', data);
      this.foodItems = data.map((item) => ({
        Id: item.id,
        Name: item.name,
        Description: item.description,
        Location: item.location,
        Rating: item.rating,
        ImageId: item.imageid,
        ImageName: item.imagename,
        imageBase64: item.imagebase64 || null,
      }));
      this.resetForm();
    });
  }

  editFoodItem(food: Food): void {
    this.editingId = food.Id;
    this.addingNew = false;
    this.form.name = food.Name;
    this.form.description = food.Description;
    this.form.location = food.Location;
    this.form.rating = food.Rating;
    this.form.imageFile = null;
    this.form.imageName = food.ImageName || '';
  }

  updateRating(item: Food, newRating: number): void {
    item.Rating = newRating;

    const formData = new FormData();
    formData.append('name', item.Name);
    formData.append('description', item.Description);
    formData.append('location', item.Location);
    formData.append('rating', newRating.toString());

    this.blogService.updateFoodItem(item.Id, formData).subscribe(() => {
      console.log(`Updated rating for ${item.Name} to ${newRating}`);
      this.fetchFoods();
    });
  }

  deleteFoodItem(id: number): void {
    if (!this.isAdmin) return;
    this.blogService.deleteFoodItem(id).subscribe(() => {
      this.fetchFoods();
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.form.imageFile = input.files[0];
      this.form.imageName = input.files[0].name;
    }
  }

  submitForm(): void {
    if (!this.isAdmin) return;

    const formData = new FormData();
    formData.append('name', this.form.name);
    formData.append('description', this.form.description);
    formData.append('location', this.form.location);
    formData.append('rating', (this.form.rating ?? 1).toString());

    if (this.form.imageFile) {
      formData.append('image', this.form.imageFile);
    }

    if (this.editingId !== null) {
      this.blogService
        .updateFoodItem(this.editingId, formData)
        .subscribe(() => {
          this.fetchFoods();
          this.resetForm();
        });
    } else if (this.addingNew) {
      this.blogService.addFoodItem(formData).subscribe(() => {
        this.fetchFoods();
        this.resetForm();
      });
    }
  }

  startAddFood(): void {
    this.addingNew = true;
    this.editingId = null;
    this.form = {
      name: '',
      description: '',
      location: '',
      rating: 1,
      imageFile: null,
      imageName: '',
    };
  }

  resetForm(): void {
    this.editingId = null;
    this.addingNew = false;
    this.form = {
      name: '',
      description: '',
      location: '',
      rating: 1,
      imageFile: null,
      imageName: '',
    };
  }

  getImageUrl(imageId: number | null): SafeHtml {
    return this.blogService.getImageUrl(imageId) as SafeHtml;
  }

  trackById(index: number, item: Food): number {
    return item.Id;
  }
}
