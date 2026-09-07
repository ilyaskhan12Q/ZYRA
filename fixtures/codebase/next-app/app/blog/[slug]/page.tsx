import React from 'react';

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  return <article>Blog Post: {params.slug}</article>;
}
