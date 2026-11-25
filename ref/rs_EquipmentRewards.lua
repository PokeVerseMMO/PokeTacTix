-- Legacy account-equipment rewards now resolve to lobby diamonds, never match inventory.
local B=require(script and script.Parent.Balance or "./Balance")
local M={}
local legacy={"elucidator","ixa","narukami","odm","blood"}
local byKey={}
for i,item in ipairs(B.Items)do byKey[item.key]={index=i,rarity=item.rarity}end
local values={Rare=150,Epic=250,Legendary=400}
function M.key(value)
 if type(value)=="number"then return legacy[value]end
 if type(value)=="string"and byKey[value]then return value end
end
function M.diamonds(value)
 local key=M.key(value);local item=key and byKey[key]
 return item and values[item.rarity]or 0
end
function M.convert(pending)
 local amount,count=0,0
 for _,value in ipairs(type(pending)=="table"and pending or{})do
  local n=M.diamonds(value);if n>0 then amount+=n;count+=1 end
 end
 return amount,count
end
function M.resolve(reward)
 if type(reward)~="table"then return end
 if reward.kind=="title"and type(reward.text)=="string"and reward.text~=""then return{diamonds=0,title=reward.text}end
 local n=reward.kind=="diamonds"and reward.amount or reward.kind=="item"and M.diamonds(reward.item)
 if type(n)=="number"and n==n and n>0 and n<math.huge and n==math.floor(n)then return{diamonds=n}end
end
-- Kept for compatibility with old callers; account rewards cannot supply battle equipment.
function M.indices()return{}end
return M
