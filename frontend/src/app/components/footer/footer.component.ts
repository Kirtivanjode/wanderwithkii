import { Component } from '@angular/core';
import { BlogService } from '../../services/blog.service';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  constructor(public imageService: BlogService) {}
  currentYear = new Date().getFullYear();
}
