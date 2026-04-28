const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function formatDate(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID
  
  try {
    const todayStr = formatDate(new Date())
    const today = new Date(`${todayStr}T00:00:00`)
    
    let result
    try {
      result = await db.collection('daily_checkin').where({ userId, dateStr: todayStr }).get()
      if (!result.data || result.data.length === 0) {
        result = await db.collection('daily_checkin').where({ userId, date: today }).get()
      }
    } catch (e) {
      result = { data: [] }
    }
    
    if (result.data.length === 0) {
      return {
        success: true,
        data: null
      }
    }
    
    return {
      success: true,
      data: result.data[0]
    }
  } catch (err) {
    console.error('Checkin today error:', err)
    return { success: true, data: null }
  }
}
