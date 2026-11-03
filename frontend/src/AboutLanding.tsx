const values = [
  { number: '01', title: 'Khách hàng là trọng tâm', text: 'Mỗi trải nghiệm được thiết kế từ nhu cầu thật và sự tin cậy lâu dài.' },
  { number: '02', title: 'Vận hành minh bạch', text: 'Chúng tôi kết nối con người, dữ liệu và quy trình để mọi cam kết đều rõ ràng.' },
  { number: '03', title: 'Phát triển bền vững', text: 'Tăng trưởng cùng đối tác, cộng đồng và những giá trị có ích mỗi ngày.' },
]

export default function AboutLanding() {
  return (
    <div className="company-page">
      <header className="company-header">
        <a className="company-brand" href="#gioi-thieu" aria-label="Công ty A - về đầu trang"><span className="company-brand__mark" aria-hidden="true">A</span><span>CÔNG TY A</span></a>
        <nav className="company-nav" aria-label="Điều hướng chính">
          <a href="#gioi-thieu">Giới thiệu</a><a href="#gia-tri">Giá trị</a><a href="#hanh-trinh">Hành trình</a><a className="company-nav__contact" href="#lien-he">Liên hệ</a>
        </nav>
      </header>
      <main>
        <section className="company-hero" id="gioi-thieu" aria-labelledby="hero-title">
          <div className="company-hero__copy">
            <p className="company-eyebrow">ABOUT US · TỪ 2012</p>
            <h1 id="hero-title">Những điều bình dị,<br /><em>được làm tử tế.</em></h1>
            <p className="company-hero__lead">Công ty A kiến tạo những sản phẩm và dịch vụ gần gũi, giúp cuộc sống hằng ngày trở nên dễ dàng, đáng tin và nhiều cảm hứng hơn.</p>
            <a className="company-button" href="#cau-chuyen">Khám phá câu chuyện của chúng tôi <span aria-hidden="true">↗</span></a>
          </div>
          <div className="company-hero__art" aria-label="Minh họa trừu tượng về sự kết nối" role="img"><div className="company-orbit company-orbit--large" /><div className="company-orbit company-orbit--small" /><div className="company-sun" /><div className="company-hero__caption">EST.<br />2012</div></div>
        </section>
        <section className="company-intro" id="cau-chuyen" aria-labelledby="intro-title">
          <p className="company-section-label">01 — CHÚNG TÔI LÀ AI</p>
          <div className="company-intro__content"><h2 id="intro-title">Một đội ngũ cùng chung niềm tin vào sức mạnh của những kết nối tốt đẹp.</h2><div><p>Khởi đầu từ một ý tưởng nhỏ, Công ty A hôm nay là nơi những con người nhiều chuyên môn cùng hợp tác để tạo ra giá trị thiết thực cho khách hàng và đối tác.</p><p>Chúng tôi tin rằng chất lượng không chỉ nằm ở sản phẩm hoàn thiện, mà còn ở sự lắng nghe, tinh thần trách nhiệm và cách chúng tôi đồng hành sau mỗi lựa chọn.</p></div></div>
        </section>
        <section className="company-values" id="gia-tri" aria-labelledby="values-title">
          <div className="company-values__heading"><p className="company-section-label">02 — GIÁ TRỊ CỐT LÕI</p><h2 id="values-title">Điều dẫn lối<br />cho mọi quyết định.</h2></div>
          <div className="company-values__list">{values.map((value) => <article className="company-value" key={value.number}><span>{value.number}</span><h3>{value.title}</h3><p>{value.text}</p></article>)}</div>
        </section>
        <section className="company-stats" id="hanh-trinh" aria-label="Dấu ấn của Công ty A"><div><strong>12+</strong><span>năm đồng hành</span></div><div><strong>50K</strong><span>khách hàng tin chọn</span></div><div><strong>120</strong><span>thành viên tận tâm</span></div><div><strong>08</strong><span>tỉnh thành hiện diện</span></div></section>
        <section className="company-contact" id="lien-he" aria-labelledby="contact-title"><p className="company-section-label">03 — CÙNG TẠO NÊN ĐIỀU CÓ Ý NGHĨA</p><h2 id="contact-title">Hãy bắt đầu<br /><em>một cuộc trò chuyện.</em></h2><a className="company-contact__email" href="mailto:hello@congtya.vn">hello@congtya.vn <span aria-hidden="true">↗</span></a></section>
      </main>
      <footer className="company-footer"><span>© 2026 CÔNG TY A</span><span>Thành phố Hồ Chí Minh, Việt Nam</span><a href="#gioi-thieu">Lên đầu trang ↑</a></footer>
    </div>
  )
}

