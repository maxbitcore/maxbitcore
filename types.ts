import React from 'react';

export interface Review {
  id: string;
  user: string;
  rating: number;
  date: string;
  comment: string;
}

export type ProductStatus = 'In Stock' | 'Sold Out' | 'Pre-Order' | 'Limited Edition' | 'Coming Soon' | 'Backordered';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  // Fix: Renamed from ProductStatus to status to match component usage and error reports
  status: ProductStatus; 
  imageUrl: string;
  gallery?: string[];
  components?: string;
  description: string;
  reviews?: any[];
  isApproved?: boolean;
  createdAt?: number;
  isPublished?: boolean; 
}

export interface BuildSubmission {
  id: string;
  timestamp: number;
  userName: string;
  userEmail: string;
  budget: string;
  deadline: string;
  purpose: string;
  cpu: string;
  gpu: string;
  ssd: string;
  manufacturer: string;
  caseSize: string;
  caseType: string;
  placement: string;
  aesthetic: string;
  resolution: string;
  requirements: string;
}

export interface JournalArticle {
  id: number;
  title: string;
  date: string;
  excerpt: string;
  image: string;
  content: React.ReactNode;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type MainTab = 
  | 'home' 
  | 'configurator'
  | 'gaming-pcs'
  | 'components'
  | 'peripherals'
  | 'journal' 
  | 'contact' 
  | 'faq' 
  | 'shipping' 
  | 'privacy' 
  | 'terms' 
  | 'returns'
  | 'admin';

export type ViewState = 
  | { type: 'tab', activeTab: MainTab }
  | { type: 'product', product: Product }
  | { type: 'journal_detail', article: JournalArticle }
  | { type: 'checkout' };