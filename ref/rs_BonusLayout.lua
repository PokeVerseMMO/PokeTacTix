-- Shared design coordinates; no reward indices are reordered by presentation.
local M={Width=1600,Height=800,SceneWidth=1240,SceneHeight=692,FOV=48,
    Camera={0,29,-39},Look={0,1.2,4},Home={0,.8,-18.3},HeroHeight=9.8,CommanderHeight=6.4}
function M.positions(offers)
    local heroes,items={},{}
    for i,o in ipairs(offers) do table.insert(o.kind=="hero" and heroes or items,i) end
    local result={}
    for n,index in ipairs(heroes) do result[index]={x=((#heroes+1)/2-n)*14,y=1.35,z=11.5,hero=true} end
    for n,index in ipairs(items) do
        local row=math.floor((n-1)/4);local column=(n-1)%4
        local count=math.min(4,#items-row*4)
        result[index]={x=((count-1)/2-column)*(row==0 and 10.5 or 9.6),y=.65,z=row==0 and -6 or -17.3,hero=false}
    end
    return result
end
-- Same vertical-FOV projection used by the fixed ViewportFrame camera.
function M.project(x,y,z)
    local cx,cy,cz=table.unpack(M.Camera);local _,ly,lz=table.unpack(M.Look)
    local dy,dz=ly-cy,lz-cz;local length=math.sqrt(dy*dy+dz*dz);dy,dz=dy/length,dz/length
    local depth=(y-cy)*dy+(z-cz)*dz
    local up=(y-cy)*dz-(z-cz)*dy
    local scale=M.SceneHeight/(2*math.tan(math.rad(M.FOV/2))*depth)
    return M.SceneWidth/2-(x-cx)*scale,M.SceneHeight/2-up*scale
end
-- One rectangle contract for GUI, picking and the visual/layout checks.
function M.presentation(p)
    local x,y=M.project(p.x,p.hero and p.y-.2 or 3.8,p.z)
    if p.hero then
        local _,head=M.project(p.x,p.y+.28+M.HeroHeight,p.z)
        return {x=x,y=y,altar={x-80,y-27,160,72},plate={x-82,y+31,164,36},
            hit={x-82,head-6,164,y+73-head},origin={x=x,y=(head+y)/2}}
    end
    return {x=x,y=y,altar={x-90,y+22,180,78},plate={x-90,y+83,180,32},
        portrait={x-42,y-42,84,84},origin={x=x,y=y}}
end
return M
