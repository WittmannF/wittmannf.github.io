export const defaultLang = 'en' as const;

export const ui = {
  en: {
    'nav.home': 'Home',
    'nav.blog': 'Blog',
    'nav.projects': 'Projects',
    'nav.resume': 'Resume',
    'nav.contact': 'Contact',
    'hero.badge': 'Senior ML Engineer · Factored (Andrew Ng)',
    'hero.title': "Hi, I'm",
    'hero.bio': 'Senior Machine Learning Engineer with 10+ years of experience in Deep Learning, Recommender Systems, NLP, and Computer Vision. Currently providing ML & GenAI consulting for S&P 600 companies at Factored.',
    'hero.cta.blog': 'View Blog',
    'hero.cta.projects': 'View Projects',
    'home.recentPosts': 'Recent Posts',
    'home.viewAll': 'View all →',
    'home.featuredProjects': 'Featured Projects',
    'blog.title': 'Blog',
    'blog.subtitle': 'Articles on Machine Learning, Deep Learning, and Data Science',
    'blog.empty': 'No posts published yet.',
    'projects.title': 'Projects',
    'projects.subtitle': 'Open-source packages and machine learning research projects',
    'projects.empty': 'No projects published yet.',
    'projects.featured': 'Featured',
    'projects.code': 'Code',
    'projects.demo': 'Demo',
    'footer.rights': 'All rights reserved.',
    'footer.builtWith': 'Built with Astro + Tailwind CSS',
    'post.backToBlog': '← Back to blog',
    'post.updatedOn': 'Updated on',
  },
  pt: {
    'nav.home': 'Início',
    'nav.blog': 'Blog',
    'nav.projects': 'Projetos',
    'nav.resume': 'Currículo',
    'nav.contact': 'Contato',
    'hero.badge': 'Engenheiro Sênior de ML · Factored (Andrew Ng)',
    'hero.title': 'Olá, sou',
    'hero.bio': 'Engenheiro Sênior de Machine Learning com mais de 10 anos de experiência em Deep Learning, Sistemas de Recomendação, PLN e Visão Computacional. Atualmente oferecendo consultoria em ML e IA Generativa na Factored.',
    'hero.cta.blog': 'Ver Blog',
    'hero.cta.projects': 'Ver Projetos',
    'home.recentPosts': 'Posts Recentes',
    'home.viewAll': 'Ver todos →',
    'home.featuredProjects': 'Projetos em Destaque',
    'blog.title': 'Blog',
    'blog.subtitle': 'Artigos sobre Machine Learning, Deep Learning e Data Science',
    'blog.empty': 'Nenhum post publicado ainda.',
    'projects.title': 'Projetos',
    'projects.subtitle': 'Pacotes open-source e projetos de pesquisa em machine learning',
    'projects.empty': 'Nenhum projeto publicado ainda.',
    'projects.featured': 'Destaque',
    'projects.code': 'Código',
    'projects.demo': 'Demo',
    'footer.rights': 'Todos os direitos reservados.',
    'footer.builtWith': 'Feito com Astro + Tailwind CSS',
    'post.backToBlog': '← Voltar para o blog',
    'post.updatedOn': 'Atualizado em',
  },
} as const;

export type Lang = keyof typeof ui;

export function useTranslations(lang: Lang) {
  return function t(key: keyof typeof ui[typeof defaultLang]): string {
    return (ui[lang] as Record<string, string>)[key] ?? (ui[defaultLang] as Record<string, string>)[key];
  };
}
