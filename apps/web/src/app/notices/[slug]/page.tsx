import {
  ContentRoute,
  contentMetadata,
  contentStaticParams,
  type SlugParams,
} from '@/components/content/content-route';

export const revalidate = 300;

export function generateStaticParams() {
  return contentStaticParams('notices');
}

export function generateMetadata({ params }: { params: SlugParams }) {
  return contentMetadata('notices', params);
}

export default function NoticePage({ params }: { params: SlugParams }) {
  return <ContentRoute family="notices" params={params} />;
}
