'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { API_URL, EMPTY_SERVICE_DATA, ServicePackagesResponse } from '@/lib/service-packages';

const FAQ_ITEMS = [
  {
    q: 'Thời gian hoàn thành dự án là bao lâu?',
    a: 'Tùy theo gói và quy mô công trình, thời gian triển khai thường từ 7 đến 30 ngày. Với nhu cầu gấp, đội ngũ có thể bóc tách lộ trình theo từng mốc để không ảnh hưởng tiến độ vận hành.'
  },
  {
    q: 'Sau khi hoàn thành có hỗ trợ tiếp không?',
    a: 'Có. Các gói đều có hỗ trợ sau bàn giao. Gói cao hơn sẽ ưu tiên theo dõi hồ sơ, bảo trì định kỳ và hỗ trợ nhanh khi cần làm việc với cơ quan hoặc chủ đầu tư.'
  },
  {
    q: 'Thanh toán theo hình thức nào?',
    a: 'Thông thường thanh toán theo tiến độ: đặt cọc khi chốt phạm vi, thanh toán tiếp ở mốc hoàn thiện hồ sơ hoặc triển khai, phần còn lại khi nghiệm thu hoặc bàn giao.'
  },
  {
    q: 'Có thể tùy chỉnh gói theo công trình thực tế không?',
    a: 'Có. Gói niêm yết là khung tham chiếu để dễ chọn nhanh. Khi công trình có nhiều hạng mục hoặc yêu cầu đặc thù, hệ thống có thể được cấu hình lại để bám đúng nhu cầu thực tế.'
  }
];

function getColorTone(color: string) {
  const tones = {
    blue: 'blue',
    red: 'red',
    orange: 'orange',
    purple: 'purple'
  } as const;

  return tones[color as keyof typeof tones] || 'blue';
}

export default function ServicePage() {
  const [serviceData, setServiceData] = useState<ServicePackagesResponse>(EMPTY_SERVICE_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadServiceData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/service-packages`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as ServicePackagesResponse;
        if (mounted) {
          setServiceData({
            packages: Array.isArray(data.packages) ? data.packages : [],
            additionalServices: Array.isArray(data.additionalServices) ? data.additionalServices : []
          });
        }
      } catch {
        if (mounted) {
          setServiceData(EMPTY_SERVICE_DATA);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadServiceData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="services-page">
      <div className="services-bg" aria-hidden="true">
        <div className="services-orb services-orb-1" />
        <div className="services-orb services-orb-2" />
        <div className="services-grid" />
      </div>

      <Navigation />

      <main className="services-shell">
        <section className="services-hero">
          <div className="services-eyebrow">
            <span className="services-eyebrow-dot" />
            Dịch vụ triển khai thực chiến
          </div>
          <h1 className="services-title">Gói dịch vụ PCCC theo nhu cầu thực tế</h1>
          <p className="services-subtitle">
            Chọn nhanh gói phù hợp để tư vấn, thiết kế, triển khai hồ sơ và đồng hành nghiệm thu.
            Mọi nội dung dưới đây đang lấy trực tiếp từ dữ liệu dịch vụ hiện tại trong hệ thống.
          </p>
        </section>

        <section className="services-section">
          <div className="services-section-head">
            <div>
              <p className="services-kicker">Bảng giá gợi ý</p>
              <h2>Gói chính</h2>
            </div>

          </div>

          <div className="services-package-grid">
            {serviceData.packages.map((pkg) => {
              const tone = getColorTone(pkg.color);

              return (
                <article
                  key={pkg.id}
                  className={`services-package-card tone-${tone} ${pkg.recommended ? 'is-recommended' : ''}`}
                >
                  {pkg.recommended && <span className="services-recommend-badge">Recommend</span>}

                  <div className="services-package-top">
                    <p className="services-package-name">{pkg.name}</p>
                    <div className="services-package-price-row">
                      <span className="services-package-price">{pkg.price}</span>
                    </div>
                    <p className="services-package-duration">{pkg.duration}</p>
                  </div>

                  <ul className="services-feature-list">
                    {pkg.features.map((feature, idx) => (
                      <li key={`${pkg.id}-${idx}`}>
                        <span className="services-feature-check">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button className="services-package-cta" type="button">
                    Chọn gói này
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="services-section">
          <div className="services-section-head">
            <div>
              <p className="services-kicker">Hỗ trợ thêm</p>
              <h2>Dịch vụ bổ sung</h2>
            </div>
            <p className="services-section-copy">Bổ sung từng hạng mục riêng nếu công trình không cần trọn gói.</p>
          </div>

          <div className="services-addon-grid">
            {serviceData.additionalServices.map((service) => (
              <article key={service.id} className="services-addon-card">
                <div className="services-addon-icon">{service.icon}</div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <div className="services-addon-foot">
                  <span>{service.price}</span>
                  <button type="button">Chi tiết</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="services-cta-panel">
          <div>
            <p className="services-kicker services-kicker-light">Chưa rõ nên chọn gói nào?</p>
            <h2>Tư vấn nhanh theo loại công trình, quy mô và ngân sách</h2>
            <p>
              Nếu chưa chốt được phạm vi, hãy bắt đầu bằng gói gần nhất với nhu cầu hiện tại.
              Đội ngũ sẽ bóc tách lại các hạng mục để tối ưu chi phí và tiến độ.
            </p>
          </div>
          <div className="services-cta-actions">
            <button className="services-cta-primary" type="button">Tư vấn miễn phí</button>
            <button className="services-cta-secondary" type="button">Gọi: 1900-xxxx</button>
          </div>
        </section>

        <section className="services-section">
          <div className="services-section-head">
            <div>
              <p className="services-kicker">Giải đáp nhanh</p>
              <h2>Câu hỏi thường gặp</h2>
            </div>
            <p className="services-section-copy">Những điểm người dùng hay hỏi trước khi chốt tư vấn.</p>
          </div>

          <div className="services-faq-list">
            {FAQ_ITEMS.map((faq) => (
              <details key={faq.q} className="services-faq-item">
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {loading && (
        <div className="services-loading-pill">
          Đang tải dữ liệu dịch vụ...
        </div>
      )}
    </div>
  );
}
