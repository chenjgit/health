const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { id } = event
  
  try {
    if (!id) {
      return { success: false, message: '计划ID不能为空' }
    }
    
    const plan = await db.collection('health_plan').doc(id).get()
    
    if (!plan.data) {
      return { success: false, message: '计划不存在' }
    }
    
    return {
      success: true,
      data: plan.data
    }
  } catch (err) {
    console.error('Plan detail error:', err)
    return { 
      success: false, 
      message: '获取计划详情失败' 
    }
  }
}
