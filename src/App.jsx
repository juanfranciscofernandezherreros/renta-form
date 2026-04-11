import { useState, useRef } from 'react'
import './App.css'

const INITIAL_STATE = {
  // 1. Datos personales
  nombre: '',
  apellidos: '',
  nif: '',
  fechaNacimiento: '',
  estadoCivil: '',
  municipio: '',
  provincia: '',
  codigoPostal: '',
  // 2. Rendimientos del trabajo
  ingresosBrutos: '',
  retencionesTrabajo: '',
  gastosTrabajo: '',
  pagadorPrincipal: '',
  // 3. Capital
  dividendos: '',
  retencionesCapMob: '',
  rendimientosInmob: '',
  gastosInmob: '',
  retencionesCapInmob: '',
  // 4. Ganancias / pérdidas
  gananciasLP: '',
  perdidasLP: '',
  gananciasCP: '',
  perdidasCP: '',
  retencionesGanancias: '',
  // 5. Deducciones
  dedVivienda: '',
  dedPensiones: '',
  dedDonaciones: '',
  dedMaternidad: '',
  dedEBT: '',
  dedAutonomica: '',
  // 6. Situación familiar
  hijos25: '',
  hijos3: '',
  discapacidad: '0',
  ascendiente: false,
  declaracionConjunta: false,
  monoparental: false,
  familiaNumerosa: false,
  // 7. Pagos fraccionados
  pagosFraccionados: '',
  basesNegativas: '',
  cuotasCompensacion: '',
}

const fmt = v =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const n = v => parseFloat(v) || 0

function calcular(f) {
  const ingBrutos     = n(f.ingresosBrutos)
  const retTrabajo    = n(f.retencionesTrabajo)
  const gastosTrab    = n(f.gastosTrabajo)
  const dividendos    = n(f.dividendos)
  const retCapMob     = n(f.retencionesCapMob)
  const rendInmob     = n(f.rendimientosInmob)
  const gastosInmob   = n(f.gastosInmob)
  const retCapInmob   = n(f.retencionesCapInmob)
  const ganLP         = n(f.gananciasLP)
  const perLP         = n(f.perdidasLP)
  const ganCP         = n(f.gananciasCP)
  const perCP         = n(f.perdidasCP)
  const retGan        = n(f.retencionesGanancias)
  const dedVivienda   = n(f.dedVivienda)
  const dedPension    = n(f.dedPensiones)
  const dedDonacion   = n(f.dedDonaciones)
  const dedMatern     = n(f.dedMaternidad)
  const dedEBT        = n(f.dedEBT)
  const dedAuton      = n(f.dedAutonomica)
  const hijos25       = n(f.hijos25)
  const hijos3        = n(f.hijos3)
  const pagosFracc    = n(f.pagosFraccionados)
  const basesNeg      = n(f.basesNegativas)
  const cuotasComp    = n(f.cuotasCompensacion)

  const rdtoTrabajo    = Math.max(0, ingBrutos - gastosTrab - 2000)
  const rdtoCapInmob   = Math.max(0, rendInmob - gastosInmob)
  const gananciaAhorro = (ganLP - perLP) + (ganCP - perCP)

  const baseGeneral = Math.max(0, rdtoTrabajo + rdtoCapInmob - basesNeg - dedPension)
  const baseAhorro  = Math.max(0, dividendos + gananciaAhorro)

  const tipoGeneral = baseGeneral <= 12450  ? 0.19
                    : baseGeneral <= 20200  ? 0.24
                    : baseGeneral <= 35200  ? 0.30
                    : baseGeneral <= 60000  ? 0.37
                    : baseGeneral <= 300000 ? 0.45
                    : 0.47

  const tipoAhorro = gananciaAhorro <= 6000   ? 0.19
                   : gananciaAhorro <= 50000  ? 0.21
                   : gananciaAhorro <= 200000 ? 0.23
                   : 0.28

  const cuotaIntegra = baseGeneral * tipoGeneral + baseAhorro * tipoAhorro

  const minPersonal    = 5550 * tipoGeneral
  const minHijos       = hijos25 * 2400 * tipoGeneral + hijos3 * 2800 * tipoGeneral
  const totalDeducciones = dedVivienda + dedDonacion * 0.80 + dedMatern + dedEBT * 0.50 + dedAuton + minPersonal + minHijos

  const cuotaLiquida = Math.max(0, cuotaIntegra - totalDeducciones)
  const totalRetenciones = retTrabajo + retCapMob + retCapInmob + retGan
  const resultado    = cuotaLiquida - totalRetenciones - pagosFracc - cuotasComp

  return { baseGeneral, baseAhorro, cuotaIntegra, totalDeducciones, cuotaLiquida, totalRetenciones, pagosFracc, cuotasComp, resultado }
}

export default function App() {
  const [form, setForm] = useState(INITIAL_STATE)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const resultRef = useRef(null)

  const handleChange = e => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleCalcular = () => {
    const res = calcular(form)
    setResult(res)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  const handleLimpiar = () => {
    if (window.confirm('¿Seguro que quiere limpiar todos los campos?')) {
      setForm(INITIAL_STATE)
      setResult(null)
    }
  }

  const showToast = (msg, type) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const res = calcular(form)

    const payload = {
      declarante: {
        nombre: form.nombre,
        apellidos: form.apellidos,
        nif: form.nif,
        fechaNacimiento: form.fechaNacimiento,
        estadoCivil: form.estadoCivil,
        domicilio: {
          municipio: form.municipio,
          provincia: form.provincia,
          codigoPostal: form.codigoPostal,
        },
      },
      rendimientosTrabajo: {
        ingresosBrutos: n(form.ingresosBrutos),
        retenciones: n(form.retencionesTrabajo),
        gastosDeducibles: n(form.gastosTrabajo),
        pagadorPrincipal: form.pagadorPrincipal,
      },
      rendimientosCapital: {
        dividendosEIntereses: n(form.dividendos),
        retencionesCapMobiliario: n(form.retencionesCapMob),
        rendimientosInmobiliario: n(form.rendimientosInmob),
        gastosDeduciblesInmob: n(form.gastosInmob),
        retencionesCapInmobiliario: n(form.retencionesCapInmob),
      },
      gananciasPerdidas: {
        gananciasLargoPlazo: n(form.gananciasLP),
        perdidasLargoPlazo: n(form.perdidasLP),
        gananciasCortoPlayzo: n(form.gananciasCP),
        perdidasCortoPlayzo: n(form.perdidasCP),
        retenciones: n(form.retencionesGanancias),
      },
      deducciones: {
        viviendaHabitual: n(form.dedVivienda),
        planesPensiones: n(form.dedPensiones),
        donaciones: n(form.dedDonaciones),
        maternidadPaternidad: n(form.dedMaternidad),
        inversionEmpresaNueva: n(form.dedEBT),
        otrasAutonomicas: n(form.dedAutonomica),
      },
      situacionFamiliar: {
        hijosMenores25: n(form.hijos25),
        hijosMenores3: n(form.hijos3),
        discapacidad: form.discapacidad,
        ascendienteACargo: form.ascendiente,
        declaracionConjunta: form.declaracionConjunta,
        familiaMonoparental: form.monoparental,
        familiaNumerosa: form.familiaNumerosa,
      },
      pagosFraccionados: {
        pagosIngresados: n(form.pagosFraccionados),
        basesNegativasCompensar: n(form.basesNegativas),
        cuotasDiferenciasCompensar: n(form.cuotasCompensacion),
      },
      resultadoCalculado: {
        baseImponibleGeneral: res.baseGeneral,
        baseImponibleAhorro: res.baseAhorro,
        cuotaIntegra: res.cuotaIntegra,
        totalDeducciones: res.totalDeducciones,
        cuotaLiquida: res.cuotaLiquida,
        totalRetenciones: res.totalRetenciones,
        resultado: res.resultado,
      },
    }

    setSubmitting(true)
    try {
      const response = await fetch('https://api.renta-form.example/v1/irpf/declaraciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        showToast('✅ Declaración enviada correctamente. Conserve el número de referencia que recibirá por correo electrónico.', 'success')
      } else {
        showToast(`❌ Error al enviar la declaración (HTTP ${response.status}). Inténtelo de nuevo.`, 'error')
      }
    } catch {
      showToast('❌ No se pudo conectar con el servidor. Compruebe su conexión e inténtelo de nuevo.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const provinces = [
    'Álava','Albacete','Alicante','Almería','Asturias','Ávila','Badajoz','Baleares',
    'Barcelona','Burgos','Cáceres','Cádiz','Cantabria','Castellón','Ciudad Real',
    'Córdoba','La Coruña','Cuenca','Gerona','Granada','Guadalajara','Guipúzcoa',
    'Huelva','Huesca','Jaén','León','Lérida','Lugo','Madrid','Málaga','Murcia',
    'Navarra','Orense','Palencia','Las Palmas','Pontevedra','La Rioja','Salamanca',
    'Segovia','Sevilla','Soria','Tarragona','S.C. Tenerife','Teruel','Toledo',
    'Valencia','Valladolid','Vizcaya','Zamora','Zaragoza','Ceuta','Melilla',
  ]

  return (
    <>
      <header>
        <div className="logo">AEAT</div>
        <div className="header-text">
          <h1>Declaración de la Renta 2025</h1>
          <p>Impuesto sobre la Renta de las Personas Físicas (IRPF) · Ejercicio fiscal 2025</p>
        </div>
      </header>

      <div className="card">
        {/* Progress bar */}
        <div className="progress-bar">
          <div className="step done">   <div className="bubble">✓</div> Identificación </div>
          <div className="step active"> <div className="bubble">2</div> Rendimientos  </div>
          <div className="step">        <div className="bubble">3</div> Deducciones    </div>
          <div className="step">        <div className="bubble">4</div> Resultado      </div>
          <div className="step">        <div className="bubble">5</div> Presentación   </div>
        </div>

        <div className="info-box">
          <strong>📋 Instrucciones</strong>
          Rellene todos los campos con los datos que figuran en su <em>borrador de declaración</em> facilitado por la AEAT.
          Los importes se expresan en euros (€). Compruebe sus datos antes de firmar.
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* 1. Datos personales */}
          <div className="section-title">1. Datos del Declarante</div>
          <div className="form-grid">
            <div className="field">
              <label>Nombre</label>
              <input type="text" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre" required />
            </div>
            <div className="field">
              <label>Apellidos</label>
              <input type="text" name="apellidos" value={form.apellidos} onChange={handleChange} placeholder="Primer apellido Segundo apellido" required />
            </div>
            <div className="field">
              <label>NIF / NIE</label>
              <input type="text" name="nif" value={form.nif} onChange={handleChange} placeholder="00000000A" maxLength={9} required />
            </div>
            <div className="field">
              <label>Fecha de nacimiento</label>
              <input type="date" name="fechaNacimiento" value={form.fechaNacimiento} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Estado civil</label>
              <select name="estadoCivil" value={form.estadoCivil} onChange={handleChange}>
                <option value="">– Seleccione –</option>
                {['Soltero/a','Casado/a','Viudo/a','Divorciado/a','Separado/a','Pareja de hecho'].map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Domicilio fiscal – Municipio</label>
              <input type="text" name="municipio" value={form.municipio} onChange={handleChange} placeholder="Ciudad" />
            </div>
            <div className="field">
              <label>Provincia</label>
              <select name="provincia" value={form.provincia} onChange={handleChange}>
                <option value="">– Seleccione –</option>
                {provinces.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Código postal</label>
              <input type="text" name="codigoPostal" value={form.codigoPostal} onChange={handleChange} placeholder="28001" maxLength={5} />
            </div>
          </div>

          {/* 2. Rendimientos del trabajo */}
          <div className="section-title">2. Rendimientos del Trabajo <span className="badge">Casilla 001–005</span></div>
          <div className="form-grid cols-3">
            <div className="field">
              <label>Ingresos brutos anuales</label>
              <div className="currency-wrap"><input type="number" name="ingresosBrutos" value={form.ingresosBrutos} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Retenciones practicadas</label>
              <div className="currency-wrap"><input type="number" name="retencionesTrabajo" value={form.retencionesTrabajo} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Gastos deducibles (SS, etc.)</label>
              <div className="currency-wrap"><input type="number" name="gastosTrabajo" value={form.gastosTrabajo} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field full">
              <label>Empresa / Pagador principal</label>
              <input type="text" name="pagadorPrincipal" value={form.pagadorPrincipal} onChange={handleChange} placeholder="Razón social o nombre del pagador" />
            </div>
          </div>

          {/* 3. Rendimientos del capital */}
          <div className="section-title">3. Rendimientos del Capital <span className="badge">Casilla 020–060</span></div>
          <div className="form-grid cols-3">
            <div className="field">
              <label>Dividendos e intereses</label>
              <div className="currency-wrap"><input type="number" name="dividendos" value={form.dividendos} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Retenciones capital mobiliario</label>
              <div className="currency-wrap"><input type="number" name="retencionesCapMob" value={form.retencionesCapMob} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Rendimientos capital inmobiliario</label>
              <div className="currency-wrap"><input type="number" name="rendimientosInmob" value={form.rendimientosInmob} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Gastos deducibles (inmobiliario)</label>
              <div className="currency-wrap"><input type="number" name="gastosInmob" value={form.gastosInmob} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Retenciones capital inmobiliario</label>
              <div className="currency-wrap"><input type="number" name="retencionesCapInmob" value={form.retencionesCapInmob} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
          </div>

          {/* 4. Ganancias / pérdidas */}
          <div className="section-title">4. Ganancias y Pérdidas Patrimoniales <span className="badge">Casilla 300–360</span></div>
          <div className="form-grid cols-3">
            <div className="field">
              <label>Ganancias a largo plazo (&gt;1 año)</label>
              <div className="currency-wrap"><input type="number" name="gananciasLP" value={form.gananciasLP} onChange={handleChange} step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Pérdidas a largo plazo (&gt;1 año)</label>
              <div className="currency-wrap"><input type="number" name="perdidasLP" value={form.perdidasLP} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Ganancias a corto plazo (≤1 año)</label>
              <div className="currency-wrap"><input type="number" name="gananciasCP" value={form.gananciasCP} onChange={handleChange} step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Pérdidas a corto plazo (≤1 año)</label>
              <div className="currency-wrap"><input type="number" name="perdidasCP" value={form.perdidasCP} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Retenciones ganancias patrimoniales</label>
              <div className="currency-wrap"><input type="number" name="retencionesGanancias" value={form.retencionesGanancias} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
          </div>

          {/* 5. Deducciones */}
          <div className="section-title">5. Deducciones y Reducciones <span className="badge">Casilla 500–580</span></div>
          <div className="form-grid cols-3">
            <div className="field">
              <label>Deducción vivienda habitual</label>
              <div className="currency-wrap"><input type="number" name="dedVivienda" value={form.dedVivienda} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Aportaciones planes de pensiones</label>
              <div className="currency-wrap"><input type="number" name="dedPensiones" value={form.dedPensiones} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Donaciones a ONGs / Partidos</label>
              <div className="currency-wrap"><input type="number" name="dedDonaciones" value={form.dedDonaciones} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Deducción maternidad / paternidad</label>
              <div className="currency-wrap"><input type="number" name="dedMaternidad" value={form.dedMaternidad} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Inversión en empresa nueva (EBT)</label>
              <div className="currency-wrap"><input type="number" name="dedEBT" value={form.dedEBT} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Otras deducciones autonómicas</label>
              <div className="currency-wrap"><input type="number" name="dedAutonomica" value={form.dedAutonomica} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
          </div>

          {/* 6. Situación familiar */}
          <div className="section-title">6. Situación Familiar y Mínimos</div>
          <div className="form-grid cols-3">
            <div className="field">
              <label>N.º hijos menores de 25 años</label>
              <input type="number" name="hijos25" value={form.hijos25} onChange={handleChange} min="0" max="20" placeholder="0" />
            </div>
            <div className="field">
              <label>N.º hijos menores de 3 años</label>
              <input type="number" name="hijos3" value={form.hijos3} onChange={handleChange} min="0" max="10" placeholder="0" />
            </div>
            <div className="field">
              <label>Discapacidad reconocida (%)</label>
              <select name="discapacidad" value={form.discapacidad} onChange={handleChange}>
                <option value="0">Sin discapacidad</option>
                <option value="33">33 % – 64 %</option>
                <option value="65">65 % o más</option>
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="check-row">
              <input type="checkbox" id="ascendiente" name="ascendiente" checked={form.ascendiente} onChange={handleChange} />
              <label htmlFor="ascendiente">Ascendiente (padre/madre) a cargo con rentas &lt; 8.000 €</label>
            </div>
            <div className="check-row">
              <input type="checkbox" id="conjunta" name="declaracionConjunta" checked={form.declaracionConjunta} onChange={handleChange} />
              <label htmlFor="conjunta">Declaración conjunta (matrimonio / pareja de hecho)</label>
            </div>
            <div className="check-row">
              <input type="checkbox" id="monoparental" name="monoparental" checked={form.monoparental} onChange={handleChange} />
              <label htmlFor="monoparental">Familia monoparental</label>
            </div>
            <div className="check-row">
              <input type="checkbox" id="numerosa" name="familiaNumerosa" checked={form.familiaNumerosa} onChange={handleChange} />
              <label htmlFor="numerosa">Familia numerosa</label>
            </div>
          </div>

          {/* 7. Pagos fraccionados */}
          <div className="section-title">7. Pagos Fraccionados y Compensaciones</div>
          <div className="form-grid cols-3">
            <div className="field">
              <label>Pagos fraccionados ingresados</label>
              <div className="currency-wrap"><input type="number" name="pagosFraccionados" value={form.pagosFraccionados} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Bases negativas a compensar (años ant.)</label>
              <div className="currency-wrap"><input type="number" name="basesNegativas" value={form.basesNegativas} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
            <div className="field">
              <label>Cuotas diferencias a compensar</label>
              <div className="currency-wrap"><input type="number" name="cuotasCompensacion" value={form.cuotasCompensacion} onChange={handleChange} min="0" step="0.01" placeholder="0,00" /></div>
            </div>
          </div>

          {/* Resultado */}
          <div className="result-panel" ref={resultRef}>
            <h3>📊 Resultado Estimado de la Declaración</h3>
            <div className="result-row">
              <span className="label">Base imponible general</span>
              <span className="value">{result ? fmt(result.baseGeneral) : '– €'}</span>
            </div>
            <div className="result-row">
              <span className="label">Base imponible del ahorro</span>
              <span className="value">{result ? fmt(result.baseAhorro) : '– €'}</span>
            </div>
            <div className="result-row">
              <span className="label">Cuota íntegra total</span>
              <span className="value">{result ? fmt(result.cuotaIntegra) : '– €'}</span>
            </div>
            <div className="result-row">
              <span className="label">Total deducciones</span>
              <span className="value">{result ? fmt(result.totalDeducciones) : '– €'}</span>
            </div>
            <div className="result-row">
              <span className="label">Cuota líquida</span>
              <span className="value">{result ? fmt(result.cuotaLiquida) : '– €'}</span>
            </div>
            <div className="result-row">
              <span className="label">Retenciones e ingresos a cuenta</span>
              <span className="value">{result ? fmt(result.totalRetenciones + result.pagosFracc + result.cuotasComp) : '– €'}</span>
            </div>
            <hr style={{ border: 'none', borderTop: '2px solid #003087', margin: '10px 0' }} />
            <div className="result-total">
              <span>Resultado (cuota diferencial)</span>
              {result ? (
                <span className={`value ${result.resultado > 0 ? 'pagar' : 'devolver'}`}>
                  {result.resultado > 0
                    ? '▲ A PAGAR: ' + fmt(result.resultado)
                    : '▼ A DEVOLVER: ' + fmt(Math.abs(result.resultado))}
                </span>
              ) : (
                <span className="value">Calcule primero ▶</span>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={handleLimpiar}>🗑 Limpiar</button>
            <button type="button" className="btn btn-primary" onClick={handleCalcular}>🧮 Calcular resultado</button>
            <button type="submit" className="btn btn-success" disabled={submitting}>
              {submitting ? '⏳ Enviando…' : '📤 Enviar declaración'}
            </button>
          </div>

        </form>
      </div>

      <footer>
        <p>Este formulario es meramente informativo y no constituye una presentación oficial ante la AEAT.</p>
        <p>Agencia Tributaria · <a href="https://www.agenciatributaria.es" target="_blank" rel="noreferrer">www.agenciatributaria.es</a> · Declaración de la Renta 2025</p>
      </footer>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
