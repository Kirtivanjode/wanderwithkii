import {
  Component,
  OnInit,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { AuthService } from '../../services/auth.service';

interface Comment {
  id: number;
  username: string;
  message: string;
}

interface BlogPost {
  id: number;
  title: string;
  summary: string;
  author: string;
  post_date: string; // raw date from backend
  date?: string; // formatted for template
  likes: number;
  logoid?: number;
  commentList?: Comment[];
  comments?: number;
  isLiked?: boolean;
  showFullSummary?: boolean;
  showComments?: boolean;
  imageIds?: number[];
  isHighlighted?: boolean;
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

  blogPosts: BlogPost[] = [];
  isAdmin = false;
  showModal = false;
  loginRequiredMessage = '';
  editingPostId: number | null = null;
  highlightPostId: number | null = null;
  shouldScrollToHighlight = false;
  newCommentMap: { [postId: number]: string } = {};

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

  constructor(
    private blogService: BlogService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUserFromStorage();
    this.isAdmin =
      user?.role === 'admin' && this.router.url.startsWith('/admin');

    this.route.paramMap.subscribe((paramMap) => {
      const postId = paramMap.get('id') ? +paramMap.get('id')! : null;

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
      highlighted?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 100);
  }

  getImageUrl(id: number | null): string {
    return this.blogService.getImageUrl(id);
  }

  loadPosts(): void {
    const username = this.authService.getUsername() || undefined;

    this.blogService.getAllPosts(username).subscribe({
      next: (posts: any[]) => {
        console.log('RAW POSTS FROM BACKEND:', posts);

        this.blogPosts = posts.map((p) => ({
          ...p,
          date: this.datePipe.transform(p.post_date, 'medium'),
          isLiked: p.isliked,
          likes: p.likes || 0,
          commentList: [],
          comments: p.commentcount || 0,
          showFullSummary: false,
          showComments: false,
          imageIds: p.imageid ? [p.imageid] : [],
          isHighlighted: this.highlightPostId === p.id, // ✅ mark highlighted post
        }));
      },
      error: (err) => console.error('Error loading posts', err),
    });
  }

  isLoggedIn(): boolean {
    return !!this.authService.getUserFromStorage();
  }

  getCurrentUsername(): string | null {
    return this.authService.getUsername();
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
    this.form = {
      postImage: null,
      logoImage: null,
      postImageName: '',
      logoImageName: '',
    };
    this.showModal = true;
  }

  resetForm(): void {
    this.newPost = { title: '', summary: '', author: 'Wander With KI' };
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
    if (this.form.postImage) formData.append('postImage', this.form.postImage);

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
    if (!this.editingPostId) return;

    const formData = new FormData();
    formData.append('title', this.newPost.title);
    formData.append('summary', this.newPost.summary);
    formData.append('author', this.newPost.author);
    if (this.form.postImage) formData.append('postImage', this.form.postImage);
    if (this.form.logoImage) formData.append('logoImage', this.form.logoImage);

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
    if (!confirm(`Delete post "${post.title}"?`)) return;

    this.blogService.deletePost(post.id).subscribe({
      next: () => this.blogPosts.splice(index, 1),
      error: (err) => console.error('Delete failed', err),
    });
  }

  onImageSelected(event: Event, type: 'post' | 'logo'): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    if (type === 'post') {
      this.form.postImage = file;
      this.form.postImageName = file.name;
    } else {
      this.form.logoImage = file;
      this.form.logoImageName = file.name;
    }
  }

  toggleComments(index: number): void {
    const post = this.blogPosts[index];
    post.showComments = !post.showComments;

    if (post.showComments && !post.commentList?.length) {
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

    const trimmed = message.trim();
    if (!trimmed) return;

    const user = this.authService.getUserFromStorage();
    const post = this.blogPosts[index];

    this.blogService
      .addComment({
        post_id: post.id,
        username: user.username,
        message: trimmed,
      })
      .subscribe({
        next: () => {
          post.commentList = post.commentList || [];
          post.commentList.unshift({
            id: 0,
            username: user.username,
            message: trimmed,
          });
          post.comments = post.commentList.length;
          this.newCommentMap[post.id] = '';
        },
        error: (err) => console.error('Failed to add comment', err),
      });
  }

  deleteComment(postId: number, commentId: number): void {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    this.blogService.deleteComment(commentId).subscribe({
      next: () => {
        const post = this.blogPosts.find((p) => p.id === postId);
        if (post?.commentList) {
          post.commentList = post.commentList.filter((c) => c.id !== commentId);
          post.comments = post.commentList.length;
        }
      },
      error: (err) => {
        console.error('Failed to delete comment', err);
        alert('Failed to delete comment.');
      },
    });
  }

  likePost(postId: number): void {
    const username = this.authService.getUsername();
    if (!username) {
      this.promptLogin();
      return;
    }

    const post = this.blogPosts.find((p) => p.id === postId);
    if (!post) return;

    this.blogService.likePost(postId, username).subscribe({
      next: (res) => {
        post.isLiked = res.isLiked;
        post.likes = res.likes;
      },
      error: (err) => console.error('Failed to toggle like', err),
    });
  }
}
