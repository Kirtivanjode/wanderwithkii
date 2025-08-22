import { Component, OnInit } from '@angular/core';
import { BlogService } from '../../services/blog.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Adventure } from '../../models/post';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-adventure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './adventure.component.html',
  styleUrls: ['./adventure.component.css'],
})
export class AdventureComponent implements OnInit {
  isAdmin = false;
  adventures: Adventure[] = [];
  editingId: number | null = null;
  addingNew = false;

  form: {
    description: string;
    location: string;
    imageFile: File | null;
    Name: string;
  } = {
    description: '',
    location: '',
    imageFile: null,
    Name: '',
  };

  imagePreview: string | ArrayBuffer | null = null;

  constructor(
    private blogService: BlogService,
    private router: Router,
  ) {}

  ngOnInit() {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const currentUrl = this.router.url;

    this.isAdmin = user?.role === 'admin' && currentUrl.startsWith('/admin');
    console.log('Admin check:', this.isAdmin, 'URL:', currentUrl);

    this.fetchAdventures();
  }

  fetchAdventures() {
    this.blogService.getAdventures().subscribe((data: any[]) => {
      console.log('Fetched Adventures:', data);

      this.adventures = data.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        location: item.location,
        imageid: item.imageid,
        imageBase64: item.imagebase64 || null,
      }));

      this.resetForm();
    });
  }

  startAddAdventure() {
    this.addingNew = true;
    this.editingId = null;
    this.form = { description: '', location: '', imageFile: null, Name: '' };
    this.imagePreview = null;
  }

  editAdventure(adventure: Adventure) {
    this.editingId = adventure.id;
    this.addingNew = false;
    this.form = {
      Name: adventure.name || '',
      description: adventure.description,
      location: adventure.location,
      imageFile: null,
    };
    this.imagePreview = null;
  }

  deleteAdventure(id: number) {
    if (!this.isAdmin) return;
    if (!confirm('Are you sure you want to delete this adventure?')) return;

    this.blogService.deleteAdventure(id).subscribe(() => {
      this.fetchAdventures();
    });
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.form.imageFile = input.files[0];

      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result;
      };
      reader.readAsDataURL(this.form.imageFile);
    }
  }

  submitForm() {
    if (!this.isAdmin) return;

    const formData = new FormData();
    formData.append('name', this.form.Name);
    formData.append('description', this.form.description);
    formData.append('location', this.form.location);
    if (this.form.imageFile) {
      formData.append('image', this.form.imageFile);
    }

    if (this.editingId) {
      this.blogService
        .updateAdventure(this.editingId, formData)
        .subscribe(() => {
          this.fetchAdventures();
          this.resetForm();
        });
    } else if (this.addingNew) {
      this.blogService.addAdventure(formData).subscribe(() => {
        this.fetchAdventures();
        this.resetForm();
      });
    }
  }

  resetForm() {
    this.editingId = null;
    this.addingNew = false;
    this.form = { description: '', location: '', imageFile: null, Name: '' };
    this.imagePreview = null;
  }

  getImageUrl(imageid: number | null): SafeHtml {
    return this.blogService.getImageUrl(imageid) as SafeHtml;
  }

  trackById(index: number, item: Adventure): number {
    return item.id;
  }
}
