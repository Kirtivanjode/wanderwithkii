import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { BlogComponent } from './components/blog/blog.component';
import { DestinationComponent } from './components/destination/destination.component';
import { AdventureComponent } from './components/adventure/adventure.component';
import { FoodComponent } from './components/food/food.component';
import { FormpageComponent } from './components/formpage/formpage.component';
import { AdminFormpageComponent } from './components/admin-formpage/admin-formpage.component';
import { adminGuard } from './guards/admin.guard';
import { SettingsComponent } from './components/settings/settings.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'blog', component: BlogComponent },
  { path: 'adventure', component: AdventureComponent },
  { path: 'food', component: FoodComponent },
  { path: 'destinations', component: DestinationComponent },
  { path: 'formpage', component: FormpageComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'blog/:id', component: BlogComponent },
  { path: 'admin/formpage', component: AdminFormpageComponent },

  { path: 'admin/home', component: HomeComponent, canActivate: [adminGuard] },
  { path: 'admin/blog', component: BlogComponent, canActivate: [adminGuard] },
  {
    path: 'admin/adventure',
    component: AdventureComponent,
    canActivate: [adminGuard],
  },
  { path: 'admin/food', component: FoodComponent, canActivate: [adminGuard] },
  {
    path: 'admin/destinations',
    component: DestinationComponent,
    canActivate: [adminGuard],
  },

  { path: '**', redirectTo: '', pathMatch: 'full' },
];
