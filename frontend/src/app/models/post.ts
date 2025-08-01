// export interface BlogPost {
//   post_date: string | number | Date;
//   id: number;
//   title: string;
//   summary: string;
//   author: string;
//   date: string;
//   logoImageId: number;
//   postImages: { ImageId: number }[]; // From JSON array of { ImageId }
//   likes: number;
//   isLiked: boolean;
//   comments: number;
//   commentList?: { username: string; message: string }[];
//   showComments?: boolean;
//   showFullSummary?: boolean;
// }

import { SafeUrl } from '@angular/platform-browser';

export interface updateFoodItem {
  id: number;
  name: string;
  description: string;
  image: string;
  location: string;
  taste: string;
  rating: number;
}

export interface Adventure {
  name: string;
  id: number;
  description: string;
  location: string;
  imageid: number;
}

export interface CommentRequest {
  post_id: number;
  username: string;
  message: string;
}

export interface BucketListItem {
  id: number;
  name: string;
  completed: boolean;
  emoji: string;
  latitude: number;
  longitude: number;
  funFact: string;
  uniqueThing: string;
  country: string;
  isWishlist: boolean;
}

export interface WebsiteSection {
  id: number;
  type: string;
  title: string;
  description: string;
  content1: string;
  content2: string;
  imageid: number;
  selectedFile?: File;
  previewUrl?: string;
  isEditing?: boolean;
  cacheBustedUrl?: SafeUrl | '';
}

export interface Food {
  Id: number;
  Name: string;
  Description: string;
  Location: string;
  Rating: number;
  ImageId: number | null;
  ImageName?: string;
}

export interface PostLikesResponse {
  postId: number;
  likedBy: { username: string; liked_at: string }[];
}

export interface Comment {
  username: string;
  message: string;
}

export interface WishlistDto {
  Id: number;
  Name: string;
  Country: string;
  Latitude: number;
  Longitude: number;
  Emoji: string;
}
