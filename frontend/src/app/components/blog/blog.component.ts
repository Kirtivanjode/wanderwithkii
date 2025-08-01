import {
  Component,
  OnInit,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { BlogService } from '../../services/blog.service';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';

interface BlogPost {
  isHighlighted: boolean;
  id: number;
  title: string;
  summary: string;
  author: string;
  post_date: string;
  likes: number;
  logoid?: number;
  commentCount?: number;
  comments?: number;
  commentList?: Comment[];
  showComments?: boolean;
  isLiked?: boolean;
  date?: string;
  likedBy?: string[];
  showFullSummary?: boolean;
  imageIds?: number[];
}

interface Comment {
  id: number;
  username: string;
  message: string;
}

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.css'],
  providers: [DatePipe],
})
export class BlogComponent implements OnInit, AfterViewInit {
  @ViewChildren('postCard') postCards!: QueryList<ElementRef>;

  showModal = false;
  loginRequiredMessage = '';
  newCommentMap: { [postId: number]: string } = {};

  isAdmin = false;
  editingPostId: number | null = null;

  blogPosts: BlogPost[] = [];
  newPost = {
    title: '',
    author: 'Wander With KI',
    summary: '',
  };

  form = {
    postImage: null as File | null,
    logoImage: null as File | null,
    postImageName: '',
    logoImageName: '',
  };

  highlightPostId: number | null = null;
  shouldScrollToHighlight = false;

  constructor(
    public blogService: BlogService,
    private router: Router,
    private datePipe: DatePipe,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private authservice: AuthService
  ) {}

  ngOnInit(): void {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const currentUrl = this.router.url;
    this.isAdmin = user?.role === 'admin' && currentUrl.startsWith('/admin');

    this.route.paramMap.subscribe((paramMap) => {
      const idParam = paramMap.get('id');
      const postId = idParam ? +idParam : null;

      this.route.queryParams.subscribe((params) => {
        const highlight = params['highlight'] === 'true';

        if (highlight && postId) {
          this.highlightPostId = postId;
          this.shouldScrollToHighlight = true;
        }

        this.loadPosts();
      });
    });
  }

  ngAfterViewInit(): void {
    this.postCards.changes.subscribe(() => {
      if (this.shouldScrollToHighlight) {
        this.scrollToHighlighted();
        this.shouldScrollToHighlight = false;
      }
    });
  }

  scrollToHighlighted(): void {
    setTimeout(() => {
      const highlighted = this.postCards.find((el) =>
        el.nativeElement.classList.contains('highlighted-post')
      );
      if (highlighted) {
        highlighted.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 100);
  }

  loadPosts(): void {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const username = user?.username;

    this.blogService.getAllPosts(username).subscribe({
      next: (posts: any[]) => {
        this.blogPosts = posts.map((p) => {
          console.log(posts);
          return {
            ...p,
            isLiked: !!p.isLiked, // This is what controls the color
            likes: p.likes || 0,
            commentList: p.commentlist || [],
            comments: parseInt(p.commentcount || '0', 10),
            showFullSummary: false,
            showComments: false,
            imageIds: Array.isArray(p.postImages)
              ? p.postImages.map((img: any) => img.ImageId)
              : p.imageid
              ? [p.imageid]
              : [],
          };
        });
      },
      error: (err) => console.error('Error loading posts', err),
    });
  }

  getImageUrl(id: number | null): SafeHtml {
    const rawUrl = id
      ? `https://wanderwithki.onrender.com/api/images/${id}`
      : '';
    return this.sanitizer.bypassSecurityTrustUrl(rawUrl);
  }

  getCurrentUsername(): string | null {
    const user = sessionStorage.getItem('user');
    return user ? JSON.parse(user).username : null;
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem('user');
  }

  promptLogin(): void {
    this.loginRequiredMessage = 'Please log in to like or comment.';
    setTimeout(() => (this.loginRequiredMessage = ''), 3000);
    this.router.navigate(['/formpage'], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  openModal(): void {
    this.resetForm();
    this.showModal = true;
  }

  openEditModal(post: BlogPost): void {
    this.editingPostId = post.id;
    this.newPost = {
      title: post.title,
      summary: post.summary,
      author: post.author,
    };

    this.form.postImage = null;
    this.form.logoImage = null;
    this.form.postImageName = '';
    this.form.logoImageName = '';
    this.showModal = true;
  }

  resetForm(): void {
    this.newPost = {
      title: '',
      summary: '',
      author: 'Wander With KI',
    };
    this.form = {
      postImage: null,
      logoImage: null,
      postImageName: '',
      logoImageName: '',
    };
    this.editingPostId = null;
  }

  savePost(): void {
    const formData = new FormData();
    formData.append('title', this.newPost.title);
    formData.append('summary', this.newPost.summary);
    formData.append('author', this.newPost.author);
    if (this.form.postImage) {
      formData.append('postImage', this.form.postImage);
    }
    // if (this.form.logoImage) {
    //   formData.append('logoImage', this.form.logoImage);
    // }

    this.blogService.createPost(formData).subscribe({
      next: () => {
        this.loadPosts();
        this.showModal = false;
        this.resetForm();
      },
      error: (err) => console.error(err),
    });
  }

  updatePost(): void {
    if (this.editingPostId === null) return;
    const formData = new FormData();
    formData.append('title', this.newPost.title);
    formData.append('summary', this.newPost.summary);
    formData.append('author', this.newPost.author);
    if (this.form.postImage) {
      formData.append('postImage', this.form.postImage);
    }
    if (this.form.logoImage) {
      formData.append('logoImage', this.form.logoImage);
    }

    this.blogService
      .updatePostWithImages(this.editingPostId, formData)
      .subscribe({
        next: () => {
          this.loadPosts();
          this.showModal = false;
          this.resetForm();
        },
        error: (err) => {
          console.error('Update failed', err);
          alert('Failed to update post');
        },
      });
  }

  deletePost(index: number): void {
    const post = this.blogPosts[index];
    if (confirm(`Delete post "${post.title}"?`)) {
      this.blogService.deletePost(post.id).subscribe({
        next: () => {
          this.blogPosts.splice(index, 1);
          alert('Post deleted');
        },
        error: (err) => console.error('Delete failed', err),
      });
    }
  }

  onImageSelected(event: Event, type: 'post' | 'logo'): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (type === 'post') {
        this.form.postImage = file;
        this.form.postImageName = file.name;
      } else {
        this.form.logoImage = file;
        this.form.logoImageName = file.name;
      }
    }
  }

  toggleComments(index: number): void {
    const post = this.blogPosts[index];
    post.showComments = !post.showComments;
    if (post.showComments && post.commentList?.length === 0) {
      this.blogService.getComments(post.id).subscribe({
        next: (comments) => {
          post.commentList = comments;
          post.comments = comments.length;
        },
        error: (err) => console.error('Failed to load comments', err),
      });
    }
  }

  addComment(index: number, message: string): void {
    if (!this.isLoggedIn()) {
      this.promptLogin();
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const user = JSON.parse(sessionStorage.getItem('user')!);
    const post = this.blogPosts[index];

    this.blogService
      .addComment({
        post_id: post.id,
        username: user.username,
        message: trimmedMessage,
      })
      .subscribe({
        next: () => {
          post.commentList = post.commentList || [];
          post.commentList.unshift({
            id: 0,
            username: user.username,
            message: trimmedMessage,
          });
          post.comments = post.commentList.length;
          this.newCommentMap[post.id] = ''; // Clear the input
        },
        error: (err) => console.error('Failed to add comment', err),
      });
  }

  deleteComment(postId: number, commentId: number): void {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    this.blogService.deleteComment(commentId).subscribe({
      next: () => {
        const post = this.blogPosts.find((p) => p.id === postId);
        if (post && post.commentList) {
          post.commentList = post.commentList.filter((c) => c.id !== commentId);
          post.comments = post.commentList.length;
        }
      },
      error: (err) => {
        console.error('Failed to delete comment:', err);
        alert('Failed to delete comment.');
      },
    });
  }

  likePost(postId: number): void {
    const username = this.authservice.getUsername();

    if (!username) {
      this.promptLogin();
      return;
    }

    const post = this.blogPosts.find((p) => p.id === postId);
    if (!post) return;

    this.blogService.likePost(postId, username).subscribe({
      next: (res) => {
        // ✅ Use actual values from backend response
        post.isLiked = res.isLiked;
        post.likes = res.likes;
      },
      error: (err) => {
        console.error('Failed to toggle like', err);
      },
    });
  }
}
