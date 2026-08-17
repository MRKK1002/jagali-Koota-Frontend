import { useRef } from 'react';
import { FiGlobe, FiMapPin } from 'react-icons/fi';
import { BsTelephone } from 'react-icons/bs';
import './MembershipCard.css';

const MembershipCard = ({ member, members, onClose }) => {
  const cardRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || 'https://billing.jagalikoota.com/api/v1/hotel';
  const BASE_URL = API_URL.replace('/api/v1/hotel', '');

  // If members array is provided, use it (for batch print); otherwise use single member
  const membersList = members || [member];

  const getPhotoUrl = (m) => {
    if (m.profileImage) {
      if (m.profileImage.startsWith('http')) return m.profileImage;
      return `${BASE_URL}${m.profileImage}`;
    }
    return null;
  };

  const getMemberNumber = (m) => {
    if (m.memberNumber) {
      const num = m.memberNumber.replace('JKM', '');
      const shortNum = String(parseInt(num)).padStart(4, '0');
      return `JK / ${shortNum}`;
    }
    return 'JK / 0001';
  };

  const getMemberSince = (m) => {
    const date = new Date(m.joiningDate || m.createdAt);
    return date.getFullYear().toString();
  };

  const getValidThrough = (m) => {
    const date = new Date(m.validUntil);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');

    // Generate front cards HTML
    const frontCards = membersList.map(m => `
      <div class="print-page">
        <div class="card-container">
          <div class="card-front">
            <div class="card-front-header">
              <div class="logo-text">JAGALI<br/>KOOTA</div>
              <div class="official-text">
                <div class="small-label">O F F I C I A L</div>
                <div class="card-title">MEMBERSHIP CARD</div>
              </div>
            </div>
            <div class="card-front-body">
              <div class="photo-section">
                <div class="photo-frame">
                  ${getPhotoUrl(m) ? `<img src="${getPhotoUrl(m)}" alt="${m.name}" />` : `
                    <svg class="photo-placeholder-svg" viewBox="0 0 80 100" fill="none">
                      <circle cx="40" cy="35" r="18" fill="#c4a882" opacity="0.6"/>
                      <ellipse cx="40" cy="85" rx="28" ry="20" fill="#c4a882" opacity="0.4"/>
                    </svg>
                  `}
                </div>
                <span class="affix-text">AFFIX PHOTOGRAPH</span>
              </div>
              <div class="details-divider">
                <div class="divider-dot"></div>
                <div class="divider-line"></div>
              </div>
              <div class="details-section">
                <div class="detail-group">
                  <div class="detail-label">M E M B E R &nbsp; N A M E</div>
                  <div class="detail-value name">${m.name}</div>
                  <div class="detail-separator"></div>
                </div>
                <div class="detail-group">
                  <div class="detail-label">M E M B E R S H I P &nbsp; N O .</div>
                  <div class="detail-value">${getMemberNumber(m)}</div>
                  <div class="detail-separator"></div>
                </div>
                <div class="detail-row">
                  <div class="detail-item">
                    <div class="detail-label">MEMBER SINCE</div>
                    <div class="detail-value">${getMemberSince(m)}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">VALID THROUGH</div>
                    <div class="detail-value bold">${getValidThrough(m)}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-front-footer">
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">P R E S I D E N T</div>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">S E C R E T A R Y</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    // Generate back cards HTML
    const backCards = membersList.map(() => `
      <div class="print-page">
        <div class="card-container">
          <div class="card-back">
            <div class="card-back-header">
              <div class="back-logo-decoration">
                <span class="deco-line"></span>
                <span class="deco-diamond">&#9670;</span>
                <span class="deco-line"></span>
              </div>
              <div class="back-logo">JAGALI<br/>KOOTA</div>
            </div>
            <div class="card-back-body">
              <div class="address-section">
                <div class="address-label">C L U B &nbsp; A D D R E S S</div>
                <div class="address-text">
                  <svg class="address-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>No.135, Lakshmikanth Nagar, Hebbal Stage 1,<br/>Mysuru 570016</span>
                </div>
              </div>
              <div class="contact-row">
                <div class="contact-item">
                  <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  <div class="contact-label">W E B S I T E</div>
                  <div class="contact-value">www.jagalikoota.com</div>
                </div>
                <div class="contact-divider"></div>
                <div class="contact-item">
                  <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <div class="contact-label">P H O N E</div>
                  <div class="contact-value">8553303101</div>
                </div>
              </div>
              <div class="disclaimer">
                <p><em>This card is the property of Jagali Koota, Mysuru, and must be carried
                by the member at all times within club premises.</em></p>
                <p><em>If found, kindly return to the address above.</em></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Membership Cards - Jagali Koota</title>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Cormorant+Garamond:wght@400;500;600;700&family=Cinzel:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          @page {
            size: A4;
            margin: 0;
          }

          body {
            font-family: 'Cormorant Garamond', Georgia, serif;
          }

          .print-page {
            width: 210mm;
            height: 297mm;
            display: flex;
            align-items: center;
            justify-content: center;
            page-break-after: always;
          }

          .print-page:last-child {
            page-break-after: avoid;
          }

          /* Card is standard CR80 debit card size: 85.6mm x 53.98mm */
          .card-container {
            width: 85.6mm;
            height: 53.98mm;
            border-radius: 3mm;
            overflow: hidden;
            border: 0.3mm solid #ccc;
          }

          .card-front {
            width: 100%; height: 100%;
            background: linear-gradient(160deg, #f7f2e8 0%, #ede6d6 100%);
            display: flex; flex-direction: column;
          }
          .card-front-header {
            background: linear-gradient(135deg, #5a1515 0%, #8b2020 50%, #6b1a1a 100%);
            padding: 3mm 4mm;
            display: flex; justify-content: space-between; align-items: center;
          }
          .logo-text {
            color: #f5ebe0; font-family: 'Cinzel', Georgia, serif;
            font-size: 10pt; font-weight: 900; letter-spacing: 1.5mm;
            text-transform: uppercase; line-height: 1.15;
          }
          .official-text { text-align: right; }
          .small-label { font-size: 5pt; color: #e8d5b5; letter-spacing: 1mm; }
          .card-title { font-size: 7pt; color: #fff; font-weight: 700; letter-spacing: 0.5mm; margin-top: 0.5mm; }
          
          .card-front-body { flex: 1; display: flex; padding: 3mm 4mm; gap: 0; }
          .photo-section { width: 20mm; display: flex; flex-direction: column; align-items: center; gap: 1mm; }
          .photo-frame {
            width: 16mm; height: 19mm;
            border: 0.4mm solid #c5a55a;
            outline: 0.4mm solid #d4b96a; outline-offset: 0.8mm;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; background: #f8f3eb;
          }
          .photo-frame img { width: 100%; height: 100%; object-fit: cover; }
          .photo-placeholder-svg { width: 10mm; height: 12mm; opacity: 0.5; }
          .affix-text { font-size: 4pt; color: #a09070; letter-spacing: 0.5mm; text-transform: uppercase; }
          
          .details-divider { display: flex; flex-direction: column; align-items: center; padding: 0 2.5mm; }
          .divider-dot { width: 1.5mm; height: 1.5mm; background: #c5a55a; border-radius: 50%; }
          .divider-line { width: 0.3mm; flex: 1; background: linear-gradient(to bottom, #c5a55a, transparent); }
          
          .details-section { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; }
          .detail-group { margin-bottom: 1.5mm; }
          .detail-separator { border-bottom: 0.2mm dotted #c5b89a; margin-top: 1.5mm; }
          .detail-label { font-size: 4.5pt; color: #8b7355; letter-spacing: 0.5mm; text-transform: uppercase; margin-bottom: 0.5mm; }
          .detail-value { font-size: 9pt; color: #2c1810; font-weight: 700; font-family: 'Playfair Display', Georgia, serif; }
          .detail-value.name { font-size: 11pt; }
          .detail-value.bold { font-weight: 900; }
          .detail-row { display: flex; gap: 5mm; margin-top: 2mm; }
          .detail-item { display: flex; flex-direction: column; }
          .detail-row .detail-label { font-size: 4pt; margin-bottom: 0.8mm; }
          .detail-row .detail-value { font-size: 10pt; font-weight: 900; }
          
          .card-front-footer { padding: 2mm 8mm 3mm; display: flex; justify-content: space-between; margin-top: auto; }
          .signature-block { text-align: center; }
          .signature-line { width: 22mm; height: 0.4mm; background: #8b2020; margin-bottom: 1mm; }
          .signature-label { font-size: 4pt; color: #8b7355; letter-spacing: 1mm; }

          /* BACK */
          .card-back {
            width: 100%; height: 100%;
            background: linear-gradient(160deg, #f7f2e8 0%, #ede6d6 100%);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            border: 0.6mm solid #8b2020; box-sizing: border-box;
            padding: 3mm 4mm;
          }
          .card-back-header { text-align: center; margin-bottom: 2mm; }
          .back-logo-decoration { display: flex; align-items: center; justify-content: center; gap: 1.5mm; margin-bottom: 1mm; }
          .deco-line { display: inline-block; width: 5mm; height: 0.3mm; background: #8b2020; }
          .deco-diamond { color: #8b2020; font-size: 4pt; }
          .back-logo { font-family: 'Cinzel', Georgia, serif; font-size: 12pt; font-weight: 900; color: #8b2020; letter-spacing: 1mm; line-height: 1.15; }
          .card-back-body { display: flex; flex-direction: column; align-items: center; width: 100%; }
          .address-section { text-align: center; margin-bottom: 2.5mm; }
          .address-label { font-size: 4.5pt; color: #8b7355; letter-spacing: 1mm; margin-bottom: 1mm; }
          .address-text { font-size: 7pt; color: #2c1810; font-family: 'Cormorant Garamond', Georgia, serif; line-height: 1.4; display: flex; align-items: flex-start; gap: 1.5mm; justify-content: center; font-weight: 600; }
          .address-icon { width: 3mm; height: 3mm; color: #8b2020; flex-shrink: 0; margin-top: 0.3mm; }
          .contact-row { display: flex; width: 80%; justify-content: center; align-items: center; gap: 4mm; padding: 2mm 0; border-top: 0.2mm solid #d8cdb8; border-bottom: 0.2mm solid #d8cdb8; margin-bottom: 2mm; }
          .contact-item { text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5mm; }
          .contact-icon { width: 3.5mm; height: 3.5mm; color: #8b2020; margin-bottom: 0.5mm; }
          .contact-label { font-size: 4pt; color: #8b7355; letter-spacing: 0.5mm; }
          .contact-value { font-size: 7pt; color: #2c1810; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 700; }
          .contact-divider { width: 0.3mm; height: 6mm; background: #c5a55a; }
          .disclaimer { text-align: center; padding: 0 4mm; font-size: 5pt; color: #5c4a3a; line-height: 1.5; font-family: 'Cormorant Garamond', Georgia, serif; }
          .disclaimer p { margin-bottom: 0.5mm; }
        </style>
      </head>
      <body>
        <!-- ALL FRONT CARDS (odd pages) -->
        ${frontCards}
        <!-- ALL BACK CARDS (even pages) -->
        ${backCards}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 800);
  };

  // For single preview, use first member
  const m = membersList[0];

  return (
    <div className="membership-card-overlay" onClick={onClose}>
      <div className="membership-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="membership-card-modal-header">
          <h2>🪪 Digital Membership Card</h2>
          <div className="card-modal-actions">
            <button className="btn-print-card" onClick={handlePrint}>
              🖨️ Print Card
            </button>
            <button className="btn-close-card" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="membership-card-preview" ref={cardRef}>
          {/* FRONT SIDE */}
          <div className="card-container">
            <div className="card-front">
              <div className="card-front-header">
                <div className="logo-text">JAGALI<br/>KOOTA</div>
                <div className="official-text">
                  <div className="small-label">O F F I C I A L</div>
                  <div className="card-title">MEMBERSHIP CARD</div>
                </div>
              </div>
              <div className="card-front-body">
                <div className="photo-section">
                  <div className="photo-frame">
                    {getPhotoUrl(m) ? (
                      <img src={getPhotoUrl(m)} alt={m.name} />
                    ) : (
                      <svg className="photo-placeholder-svg" viewBox="0 0 80 100" fill="none">
                        <circle cx="40" cy="35" r="18" fill="#c4a882" opacity="0.6"/>
                        <ellipse cx="40" cy="85" rx="28" ry="20" fill="#c4a882" opacity="0.4"/>
                      </svg>
                    )}
                  </div>
                  <span className="affix-text">AFFIX PHOTOGRAPH</span>
                </div>
                <div className="details-divider">
                  <div className="divider-dot"></div>
                  <div className="divider-line"></div>
                </div>
                <div className="details-section">
                  <div className="detail-group">
                    <div className="detail-label">M E M B E R &nbsp; N A M E</div>
                    <div className="detail-value name">{m.name}</div>
                    <div className="detail-separator"></div>
                  </div>
                  <div className="detail-group">
                    <div className="detail-label">M E M B E R S H I P &nbsp; N O .</div>
                    <div className="detail-value">{getMemberNumber(m)}</div>
                    <div className="detail-separator"></div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-item">
                      <div className="detail-label">MEMBER SINCE</div>
                      <div className="detail-value">{getMemberSince(m)}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">VALID THROUGH</div>
                      <div className="detail-value bold">{getValidThrough(m)}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-front-footer">
                <div className="signature-block">
                  <div className="signature-line"></div>
                  <div className="signature-label">P R E S I D E N T</div>
                </div>
                <div className="signature-block">
                  <div className="signature-line"></div>
                  <div className="signature-label">S E C R E T A R Y</div>
                </div>
              </div>
            </div>
          </div>

          {/* BACK SIDE */}
          <div className="card-container">
            <div className="card-back">
              <div className="card-back-header">
                <div className="back-logo-decoration">
                  <span className="deco-line"></span>
                  <span className="deco-diamond">◆</span>
                  <span className="deco-line"></span>
                </div>
                <div className="back-logo">JAGALI<br/>KOOTA</div>
              </div>
              <div className="card-back-body">
                <div className="address-section">
                  <div className="address-label">C L U B &nbsp; A D D R E S S</div>
                  <div className="address-text">
                    <FiMapPin className="address-icon" />
                    <span>No.135, Lakshmikanth Nagar, Hebbal Stage 1,<br/>Mysuru 570016</span>
                  </div>
                </div>
                <div className="contact-row">
                  <div className="contact-item">
                    <FiGlobe className="contact-icon" />
                    <div className="contact-label">W E B S I T E</div>
                    <div className="contact-value">www.jagalikoota.com</div>
                  </div>
                  <div className="contact-divider"></div>
                  <div className="contact-item">
                    <BsTelephone className="contact-icon" />
                    <div className="contact-label">P H O N E</div>
                    <div className="contact-value">8553303101</div>
                  </div>
                </div>
                <div className="disclaimer">
                  <p><em>This card is the property of Jagali Koota, Mysuru, and must be carried
                  by the member at all times within club premises.</em></p>
                  <p><em>If found, kindly return to the address above.</em></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembershipCard;
