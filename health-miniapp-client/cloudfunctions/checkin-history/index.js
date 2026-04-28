const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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
  
  const { days = 7 } = event
  
  try {
    // 计算日期范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const fromDate = new Date(today)
    fromDate.setDate(fromDate.getDate() - days)
    const todayStr = formatDate(today)
    const fromStr = formatDate(fromDate)
    
    // 查询历史记录
    const list = []

    try {
      const byStr = await db.collection('daily_checkin')
        .where({
          userId,
          dateStr: _.gte(fromStr).and(_.lte(todayStr))
        })
        .orderBy('dateStr', 'desc')
        .get()
      if (byStr.data && byStr.data.length) list.push(...byStr.data)
    } catch (e) {}

    try {
      const byDate = await db.collection('daily_checkin')
        .where({
          userId,
          date: _.gte(fromDate).and(_.lte(today))
        })
        .orderBy('date', 'desc')
        .get()
      if (byDate.data && byDate.data.length) list.push(...byDate.data)
    } catch (e) {}

    const merged = []
    const seen = new Set()
    for (const it of list) {
      const key = it._id || `${it.userId}_${it.dateStr || (it.date ? new Date(it.date).toISOString() : '')}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(it)
    }
    
    return {
      success: true,
      data: merged
    }
  } catch (err) {
    console.error('Checkin history error:', err)
    return { 
      success: false, 
      message: '获取历史记录失败' 
    }
  }
}
