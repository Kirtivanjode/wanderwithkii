import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { WebsiteSection } from '../../models/post';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  isAdmin = false;

  hero: WebsiteSection = { ...defaultSection('hero') };
  story: WebsiteSection = { ...defaultSection('story') };
  destinations: WebsiteSection[] = [];

  constructor(
    private router: Router,
    public homeService: BlogService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    this.isAdmin =
      user?.role === 'admin' && this.router.url.startsWith('/admin');

    this.loadSections();
  }

  getBackgroundStyle(imageId: number | null) {
    if (!imageId) return '';
    const url = this.homeService.getImageUrl(imageId);
    return this.sanitizer.bypassSecurityTrustStyle(
      `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${url}')`
    );
  }

  loadSections() {
    this.destinations = [];
    this.homeService.getSections().subscribe({
      next: (sections: any[]) => {
        const mappedSections = sections.map((sec) => {
          const imageid = sec.imageid ?? sec.ImageId ?? null;

          const section: WebsiteSection = {
            id: sec.id ?? sec.Id,
            type: (sec.type || sec.Type || '').toLowerCase(),
            title: sec.title || sec.Title || '',
            description: sec.description || sec.Description || '',
            content1: sec.content1 || sec.Content1 || '',
            content2: sec.content2 || sec.Content2 || '',
            imageid: imageid,
            isEditing: false,
            selectedFile: undefined,
            previewUrl: '',
            cacheBustedUrl: this.homeService.getImageUrl(imageid) as string,
            backgroundStyle:
              (sec.type || sec.Type)?.toLowerCase() === 'hero'
                ? this.getBackgroundStyle(imageid)
                : undefined,
          };

          return section;
        });

        for (const sec of mappedSections) {
          switch (sec.type) {
            case 'hero':
              this.hero = sec;
              break;
            case 'story':
              this.story = sec;
              break;
            case 'destination':
              this.destinations.push(sec);
              break;
          }
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load sections:', err);
      },
    });
  }

  editSection(section: WebsiteSection) {
    section.isEditing = true;
  }

  onFileSelected(event: Event, section: WebsiteSection) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      section.selectedFile = input.files[0];

      const reader = new FileReader();
      reader.onload = () => {
        section.previewUrl = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(section.selectedFile);
    }
  }

  saveSection(section: WebsiteSection) {
    if (!section.id) {
      console.error('No ID found for update');
      return;
    }

    this.homeService
      .updateSection(section.id, section, section.selectedFile)
      .subscribe({
        next: (response: any) => {
          section.imageid = response.imageId;
          section.cacheBustedUrl = this.homeService.getImageUrl(
            response.imageId
          ) as string;
          section.isEditing = false;
          section.selectedFile = undefined;
          section.previewUrl = '';
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Save failed', err);
        },
      });
  }

  deleteSection(section: WebsiteSection) {
    if (
      section.id &&
      confirm('Are you sure you want to delete this section?')
    ) {
      this.homeService.deleteSection(section.id).subscribe(() => {
        this.loadSections();
      });
    }
  }
}

function defaultSection(type: string): WebsiteSection {
  return {
    type,
    id: 0,
    title: '',
    description: '',
    content1: '',
    content2: '',
    imageid: 0,
    selectedFile: undefined,
    isEditing: false,
    previewUrl: '',
    cacheBustedUrl: '',
  };
}
