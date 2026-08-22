export const site = {
  name: 'Cervan',
  description:
    'Türkiye geneli nakliye, taşımacılık ve mobilya kurulum hizmetleri.',
  location: 'Ankara',
  serviceArea: 'Türkiye geneli',
  contact: {
    // Yayına çıkmadan önce bu alanları gerçek bilgilerle güncelleyin.
    phone: '',
    email: '',
    address: '',
    whatsapp: '',
  },
} as const;

export const services = [
  {
    number: '01',
    title: 'Şehir İçi Nakliye',
    description: 'Ankara içinde planlı, hızlı ve kontrollü taşıma organizasyonu.',
  },
  {
    number: '02',
    title: 'Şehirlerarası Nakliye',
    description: 'Türkiye’nin her noktasına güvenli rota ve zamanında teslimat.',
  },
  {
    number: '03',
    title: 'Evden Eve Taşıma',
    description: 'Eşyalarınızı özenle paketleyen ve taşıyan uçtan uca hizmet.',
  },
  {
    number: '04',
    title: 'Ofis Taşımacılığı',
    description: 'İş akışınızı aksatmadan kurumsal taşıma planlaması.',
  },
  {
    number: '05',
    title: 'Mobilya Montajı',
    description: 'Mobilyalarınızın yerinde, titiz ve doğru kurulumu.',
  },
  {
    number: '06',
    title: 'Demontaj & Paketleme',
    description: 'Taşıma öncesi söküm, koruma ve düzenli paketleme desteği.',
  },
] as const;
