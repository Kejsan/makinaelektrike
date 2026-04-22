import React from 'react';
import { Link } from 'react-router-dom';
import { BlogPost } from '../types';
import { ArrowRight } from 'lucide-react';
import OptimizedImage from './OptimizedImage';

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleDateString('sq-AL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const BlogCard: React.FC<{ post: BlogPost }> = ({ post }) => (
  <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-lg overflow-hidden group transition-all duration-300 transform hover:-translate-y-1 hover:shadow-neon-cyan">
    <div className="overflow-hidden">
      <OptimizedImage
        className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
        src={post.imageUrl}
        alt={post.title}
      />
    </div>
    <div className="p-6">
      <p className="text-sm text-gray-400">{formatDate(post.date)} &bull; {post.readTime} &bull; nga {post.author}</p>
      <h3 className="mt-2 text-xl font-bold text-white group-hover:text-gray-cyan transition-colors">{post.title}</h3>
      <p className="mt-3 text-gray-300 line-clamp-4">{post.excerpt}</p>
      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.slice(0, 3).map(tag => (
            <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300">
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4">
        <Link to={`/blog/${post.slug}`} className="text-gray-cyan font-semibold hover:underline group-hover:text-white transition-colors flex items-center">
          Lexo më shumë <ArrowRight size={16} className="ml-2 transform group-hover:translate-x-1 transition-transform"/>
        </Link>
      </div>
    </div>
  </div>
);

export default BlogCard;
