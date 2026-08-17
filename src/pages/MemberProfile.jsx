import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Shield, CalendarDays, Clock, CheckCircle2, XCircle, User, CreditCard, Sparkles } from "lucide-react"
import logo from "../assets/logo4.jpeg"

const MemberProfile = () => {
  const { memberId } = useParams()
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const API_URL = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"

  useEffect(() => {
    if (memberId) {
      fetchMember()
    }
  }, [memberId])

  const fetchMember = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch(`${API_URL}/member/${memberId}`)
      if (!response.ok) {
        throw new Error("Member not found")
      }
      const data = await response.json()
      const memberData = data.member || data
      setMember(memberData)
    } catch (err) {
      console.error("Error fetching member:", err)
      setError("Member not found or invalid QR code")
    } finally {
      setLoading(false)
    }
  }

  const isValid = () => {
    if (!member) return false
    return member.isActive && new Date(member.validUntil) > new Date()
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A"
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return "N/A"
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getMemberSince = () => {
    if (!member) return "2024"
    const date = new Date(member.joiningDate || member.createdAt)
    return isNaN(date.getFullYear()) ? "2024" : date.getFullYear().toString()
  }

  // ─── Loading State ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{`
          @keyframes memberSpinner {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .member-profile-page * { box-sizing: border-box; margin: 0; padding: 0; }
        `}</style>
        <div className="member-profile-page" style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a0a08 0%, #3d1810 30%, #6B2219 60%, #8B3429 100%)",
          padding: "20px",
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999,
          fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "24px",
            padding: "56px 40px",
            textAlign: "center",
            boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
            animation: "fadeIn 0.5s ease-out",
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              border: "4px solid #f3f4f6",
              borderTopColor: "#6B2219",
              borderRadius: "50%",
              margin: "0 auto 20px",
              animation: "memberSpinner 0.8s linear infinite",
            }}></div>
            <p style={{ color: "#4a1510", fontSize: "15px", fontWeight: "500" }}>Verifying membership...</p>
            <p style={{ color: "#9ca3af", fontSize: "12px", marginTop: "8px" }}>Please wait a moment</p>
          </div>
        </div>
      </>
    )
  }

  // ─── Error State ──────────────────────────────────────────────────────────
  if (error || !member) {
    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .member-profile-page * { box-sizing: border-box; margin: 0; padding: 0; }
        `}</style>
        <div className="member-profile-page" style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a0a08 0%, #3d1810 30%, #6B2219 60%, #8B3429 100%)",
          padding: "20px",
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999,
          fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "24px",
            padding: "48px 36px",
            textAlign: "center",
            boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
            maxWidth: "360px",
            width: "100%",
            animation: "fadeIn 0.5s ease-out",
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              border: "2px solid #fecaca",
            }}>
              <XCircle size={28} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#1a1a1a", marginBottom: "8px" }}>Invalid QR Code</h2>
            <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: "1.5" }}>{error || "Member not found"}</p>
            <div style={{
              marginTop: "24px",
              padding: "12px 16px",
              background: "#f9fafb",
              borderRadius: "12px",
              border: "1px solid #f3f4f6",
            }}>
              <p style={{ fontSize: "12px", color: "#9ca3af" }}>If this is a valid member card, please contact the front desk for assistance.</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── Success — Member Card ────────────────────────────────────────────────
  const valid = isValid()

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .member-profile-page * { box-sizing: border-box; }
        .member-profile-page h1, .member-profile-page h2, .member-profile-page p {
          margin: 0; padding: 0;
        }
      `}</style>
      <div className="member-profile-page" style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a0a08 0%, #3d1810 30%, #6B2219 60%, #8B3429 100%)",
        padding: "24px 16px",
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: "auto",
      }}>
        {/* Background decorations */}
        <div style={{
          position: "absolute", top: "-120px", right: "-120px",
          width: "350px", height: "350px", borderRadius: "50%",
          background: "rgba(209, 201, 188, 0.06)",
          pointerEvents: "none",
        }}></div>
        <div style={{
          position: "absolute", bottom: "-100px", left: "-100px",
          width: "300px", height: "300px", borderRadius: "50%",
          background: "rgba(209, 201, 188, 0.04)",
          pointerEvents: "none",
        }}></div>
        <div style={{
          position: "absolute", top: "40%", left: "-50px",
          width: "150px", height: "150px", borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.02)",
          pointerEvents: "none",
        }}></div>

        {/* Main Card */}
        <div style={{
          width: "100%",
          maxWidth: "400px",
          borderRadius: "28px",
          overflow: "hidden",
          background: "#ffffff",
          boxShadow: "0 30px 70px rgba(0, 0, 0, 0.5), 0 15px 30px rgba(0, 0, 0, 0.25)",
          position: "relative",
          zIndex: 1,
          animation: "scaleIn 0.6s ease-out",
        }}>
          {/* Card Header with Brand */}
          <div style={{
            background: "linear-gradient(145deg, #6B2219 0%, #8B3429 40%, #4a1510 100%)",
            padding: "36px 24px 32px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Header decorative patterns */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              backgroundImage: "radial-gradient(circle at 15% 50%, rgba(255,255,255,0.06) 0%, transparent 50%), radial-gradient(circle at 85% 20%, rgba(255,255,255,0.08) 0%, transparent 40%), radial-gradient(circle at 50% 80%, rgba(255,255,255,0.03) 0%, transparent 60%)",
            }}></div>
            {/* Gold line accent */}
            <div style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              width: "60px", height: "3px", borderRadius: "0 0 4px 4px",
              background: "linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.6), transparent)",
            }}></div>

            {/* Logo */}
            <div style={{
              position: "relative",
              display: "inline-block",
              marginBottom: "14px",
            }}>
              <div style={{
                width: "76px", height: "76px", borderRadius: "20px",
                overflow: "hidden",
                border: "3px solid rgba(255, 255, 255, 0.25)",
                boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                margin: "0 auto",
              }}>
                <img src={logo} alt="Jagali Koota" style={{
                  width: "100%", height: "100%", objectFit: "cover",
                }} />
              </div>
              {/* Verified checkmark on logo */}
              {valid && (
                <div style={{
                  position: "absolute", bottom: "-4px", right: "-4px",
                  width: "24px", height: "24px", borderRadius: "50%",
                  background: "#10b981", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  border: "2px solid #fff",
                  boxShadow: "0 2px 6px rgba(16, 185, 129, 0.4)",
                }}>
                  <CheckCircle2 size={14} color="#fff" />
                </div>
              )}
            </div>

            <h1 style={{
              color: "#ffffff", fontSize: "24px", fontWeight: "800",
              marginBottom: "4px", letterSpacing: "0.3px",
              position: "relative",
              textShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}>Jagali Koota</h1>
            <p style={{
              color: "rgba(212, 175, 55, 0.9)", fontSize: "11px", fontWeight: "600",
              letterSpacing: "3px", textTransform: "uppercase",
              position: "relative",
            }}>Members Club · Mysuru</p>
          </div>

          {/* Status Badge — overlaps header */}
          <div style={{
            display: "flex", justifyContent: "center",
            marginTop: "-18px", position: "relative", zIndex: 2,
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "10px 22px", borderRadius: "24px",
              fontSize: "13px", fontWeight: "600",
              boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
              ...(valid
                ? { background: "#ecfdf5", color: "#065f46", border: "1.5px solid #a7f3d0" }
                : { background: "#fef2f2", color: "#991b1b", border: "1.5px solid #fecaca" }),
            }}>
              {valid ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>{valid ? "Active Member" : "Membership Expired"}</span>
            </div>
          </div>

          {/* Member Info Section */}
          <div style={{ textAlign: "center", padding: "28px 24px 20px" }}>
            {/* Avatar */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "18px" }}>
              {member.profileImage ? (
                <div style={{
                  width: "90px", height: "90px", borderRadius: "50%",
                  overflow: "hidden",
                  border: "4px solid #6B2219",
                  boxShadow: "0 6px 20px rgba(107, 34, 25, 0.25)",
                }}>
                  <img src={member.profileImage} alt={member.name} style={{
                    width: "100%", height: "100%", objectFit: "cover",
                  }} />
                </div>
              ) : (
                <div style={{
                  width: "90px", height: "90px", borderRadius: "50%",
                  background: "linear-gradient(145deg, #6B2219, #8B3429)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 6px 20px rgba(107, 34, 25, 0.25)",
                  border: "4px solid rgba(107, 34, 25, 0.15)",
                }}>
                  <User size={36} color="#ffffff" strokeWidth={1.5} />
                </div>
              )}
            </div>

            {/* Name */}
            <h2 style={{
              fontSize: "24px", fontWeight: "700", color: "#1a1a1a",
              marginBottom: "6px", letterSpacing: "-0.3px",
            }}>
              {member.name}
            </h2>

            {/* Member Number */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              marginBottom: "14px",
            }}>
              <CreditCard size={14} color="#6b7280" />
              <p style={{
                fontSize: "14px", color: "#6b7280",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                letterSpacing: "1.5px",
              }}>
                {member.memberNumber}
              </p>
            </div>

            {/* Membership Type Badge */}
            <div style={{ display: "block" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                background: "linear-gradient(135deg, rgba(107, 34, 25, 0.06), rgba(107, 34, 25, 0.12))",
                borderRadius: "10px", padding: "8px 18px",
                border: "1px solid rgba(107, 34, 25, 0.12)",
              }}>
                <Shield size={14} color="#6B2219" />
                <span style={{
                  color: "#6B2219", fontSize: "12px", fontWeight: "700",
                  textTransform: "uppercase", letterSpacing: "1.2px",
                }}>
                  {member.membershipType || "Member"}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "12px", padding: "0 24px 24px",
          }}>
            <div style={{
              background: "linear-gradient(135deg, #f9fafb, #f3f4f6)",
              borderRadius: "16px", padding: "18px 14px",
              textAlign: "center", border: "1px solid #e5e7eb",
            }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "rgba(107, 34, 25, 0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 10px",
              }}>
                <CalendarDays size={18} color="#6B2219" />
              </div>
              <p style={{ fontSize: "10px", color: "#9ca3af", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "600" }}>
                Member Since
              </p>
              <p style={{ fontSize: "16px", color: "#1a1a1a", fontWeight: "700" }}>
                {getMemberSince()}
              </p>
            </div>
            <div style={{
              background: "linear-gradient(135deg, #f9fafb, #f3f4f6)",
              borderRadius: "16px", padding: "18px 14px",
              textAlign: "center", border: "1px solid #e5e7eb",
            }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: valid ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 10px",
              }}>
                <Clock size={18} color={valid ? "#10b981" : "#ef4444"} />
              </div>
              <p style={{ fontSize: "10px", color: "#9ca3af", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "600" }}>
                Valid Until
              </p>
              <p style={{ fontSize: "16px", color: "#1a1a1a", fontWeight: "700" }}>
                {formatDate(member.validUntil)}
              </p>
            </div>
          </div>

          {/* Divider with icon */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 24px", gap: "12px" }}>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, #e5e7eb)" }}></div>
            <Sparkles size={14} color="#d1d5db" />
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, #e5e7eb, transparent)" }}></div>
          </div>

          {/* Footer */}
          <div style={{ padding: "20px 24px 28px", textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              background: "#f9fafb", borderRadius: "8px",
              padding: "8px 14px", border: "1px solid #f3f4f6",
            }}>
              <Shield size={12} color="#9ca3af" />
              <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500" }}>
                Verified digital membership card
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default MemberProfile
